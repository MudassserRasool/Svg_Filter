const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');
// mongodb+srv://ameershah:wasiameer%40001@cactusdb.q95tc.mongodb.net/cactus
// MongoDB connection configuration
const MONGO_URI =
  'mongodb+srv://ameershah:wasiameer%40001@cactusdb.q95tc.mongodb.net'; // Update with your MongoDB URI
const DATABASE_NAME = 'cactus'; // Update with your database name
const COLLECTION_NAME = 'products';

// Configuration for scope of operation
const PROCESSING_SCOPE = {
  ALL: 'all',
  LIMITED: 'limited',
};

// Set processing scope and limit
const SCOPE_CONFIG = {
  type: PROCESSING_SCOPE.LIMITED, // Change to PROCESSING_SCOPE.ALL to process all documents
  limit: 20, // Increased limit to find documents with URLs
};

// Debug configuration
const DEBUG_CONFIG = {
  enabled: true, // Set to true to see document structure and debugging info
  showDocumentStructure: true, // Show first few levels of document structure
  showAllUrls: true, // Show all URL patterns found, not just HTTPS
};

// Central tracking for all links across documents
let centralLinksList = [];

const replaceFromObject = (ogObj, f) => {
  function replaceStringInObject(obj) {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = f(obj[key]);
      } else if (Array.isArray(obj[key])) {
        // If the property is an array, loop through its elements
        for (let i = 0; i < obj[key].length; i++) {
          // Check if the array element is a string before replacing
          if (typeof obj[key][i] === 'string') {
            obj[key][i] = f(obj[key][i]);
          } else if (typeof obj[key][i] === 'object') {
            // If the array element is an object, recursively call the function
            replaceStringInObject(obj[key][i]);
          }
        }
      } else if (typeof obj[key] === 'object') {
        // If the property is an object, recursively call the function
        replaceStringInObject(obj[key]);
      }
    }
  }

  const obj = JSON.parse(JSON.stringify(ogObj));
  replaceStringInObject(obj);
  return obj;
};

const replaceS3 = (d) =>
  JSON.parse(
    JSON.stringify(
      replaceFromObject(d, (str) =>
        str.includes('.s3')
          ? str
              ?.split?.('drivebuddyz')
              ?.join?.('cactus-s3')
              ?.split?.('cactus-s3')
              ?.join?.('cactus-storage-s3')
              ?.split?.('cactus-s3.s3')
              ?.join?.('cactus-storage-s3.s3')
              ?.split?.('.us-east-2')
              ?.join?.('.eu-west-3')
          : str
      )
    )
      .split('drivebuddyz.s3.')
      .join('cactus-s3.s3.')
      .split('cactus-s3.s3.')
      .join('cactus-storage-s3.')
      ?.split?.('cactus-s3.s3')
      ?.join?.('cactus-storage-s3.s3')
      ?.split?.('.us-east-2')
      ?.join?.('.eu-west-3')
  );

// Enhanced function to recursively extract URLs from nested objects
function extractHttpsUrls(obj, currentPath = '') {
  const httpsUrls = {};
  const debugInfo = {
    totalFields: 0,
    stringFields: 0,
    urlsFound: 0,
  };

  if (typeof obj !== 'object' || obj === null) {
    return { urls: httpsUrls, debug: debugInfo };
  }

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = currentPath ? `${currentPath}.${key}` : key;
    debugInfo.totalFields++;

    if (typeof value === 'string') {
      debugInfo.stringFields++;

      // Enhanced URL detection - check for various URL patterns
      const urlPatterns = [
        /^https:\/\//i, // HTTPS URLs
        /^http:\/\//i, // HTTP URLs
        /^www\./i, // URLs starting with www
        /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i, // Domain-like patterns
      ];

      let isUrl = false;
      let urlType = '';

      // Check for HTTPS first (primary target)
      if (value.match(/^https:\/\//i)) {
        httpsUrls[fullPath] = value;
        debugInfo.urlsFound++;
        isUrl = true;
        urlType = 'HTTPS';
      }
      // Also capture HTTP URLs if enabled
      else if (DEBUG_CONFIG.showAllUrls && value.match(/^http:\/\//i)) {
        httpsUrls[fullPath] = value;
        debugInfo.urlsFound++;
        isUrl = true;
        urlType = 'HTTP';
      }
      // Check for other URL-like patterns for debugging
      else if (
        DEBUG_CONFIG.enabled &&
        urlPatterns.some((pattern) => value.match(pattern))
      ) {
        if (DEBUG_CONFIG.showAllUrls) {
          console.log(
            `🔍 Found URL-like string at ${fullPath}: ${value.substring(
              0,
              100
            )}${value.length > 100 ? '...' : ''}`
          );
        }
      }

      if (DEBUG_CONFIG.enabled && isUrl) {
        console.log(
          `✅ Found ${urlType} URL at ${fullPath}: ${value.substring(0, 100)}${
            value.length > 100 ? '...' : ''
          }`
        );
      }
    } else if (typeof value === 'object' && value !== null) {
      // Recursively process nested objects and arrays
      const nested = extractHttpsUrls(value, fullPath);
      Object.assign(httpsUrls, nested.urls);
      debugInfo.totalFields += nested.debug.totalFields;
      debugInfo.stringFields += nested.debug.stringFields;
      debugInfo.urlsFound += nested.debug.urlsFound;
    }
  }

  return { urls: httpsUrls, debug: debugInfo };
}

// Function to display document structure for debugging
function debugDocumentStructure(document, documentId) {
  if (!DEBUG_CONFIG.enabled || !DEBUG_CONFIG.showDocumentStructure) return;

  console.log(`\n🔍 Document Structure for ${documentId}:`);
  console.log('Top-level keys:', Object.keys(document));

  // Show first level structure
  for (const [key, value] of Object.entries(document)) {
    if (key === '_id') continue;

    let valueInfo = '';
    if (typeof value === 'string') {
      valueInfo = `string (${value.length} chars)`;
      if (value.length < 100) {
        valueInfo += `: "${value}"`;
      } else {
        valueInfo += `: "${value.substring(0, 50)}..."`;
      }
    } else if (Array.isArray(value)) {
      valueInfo = `array (${value.length} items)`;
      // Show content of non-empty arrays
      if (value.length > 0 && value.length <= 3) {
        valueInfo += ` - Sample items: ${JSON.stringify(
          value,
          null,
          2
        ).substring(0, 200)}`;
      } else if (value.length > 3) {
        valueInfo += ` - First item: ${JSON.stringify(
          value[0],
          null,
          2
        ).substring(0, 200)}`;
      }
    } else if (typeof value === 'object' && value !== null) {
      valueInfo = `object (${Object.keys(value).length} keys)`;
      if (Object.keys(value).length > 0) {
        valueInfo += ` - Keys: [${Object.keys(value).join(', ')}]`;
      }
    } else {
      valueInfo = `${typeof value}: ${value}`;
    }

    console.log(`  ${key}: ${valueInfo}`);
  }
  console.log('');
}

// Function to ensure output directory exists
async function ensureOutputDirectory() {
  const outputDir = './urls';
  try {
    await fs.access(outputDir);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(outputDir);
      console.log('Created output directory: urls');
    } else {
      throw error;
    }
  }
  return outputDir;
}

// Function to save HTTPS URLs to JSON file
async function saveToJsonFile(documentId, httpsUrls, outputDir) {
  const filename = `${documentId}.json`;
  const filepath = path.join(outputDir, filename);

  // Extract just the URLs as an array
  const urlsArray = Object.values(httpsUrls);

  try {
    await fs.writeFile(filepath, JSON.stringify(urlsArray, null, 2));
    console.log(
      `✓ Saved ${urlsArray.length} HTTPS URLs for document ${documentId}`
    );

    // Add URLs to central list with document reference
    urlsArray.forEach((url) => {
      centralLinksList.push({
        documentId: documentId,
        url: url,
      });
    });

    return urlsArray.length;
  } catch (error) {
    console.error(
      `✗ Error saving file for document ${documentId}:`,
      error.message
    );
    return 0;
  }
}

// Function to save central links list
async function saveCentralLinksList(outputDir) {
  const centralLinksFile = path.join(outputDir, 'all_links_central.json');

  try {
    // Create a summary object with metadata
    const centralLinksData = {
      metadata: {
        totalLinks: centralLinksList.length,
        uniqueDocuments: [
          ...new Set(centralLinksList.map((item) => item.documentId)),
        ].length,
        generatedAt: new Date().toISOString(),
        scopeConfig: SCOPE_CONFIG,
      },
      links: centralLinksList,
    };

    await fs.writeFile(
      centralLinksFile,
      JSON.stringify(centralLinksData, null, 2)
    );
    console.log(
      `✓ Saved central links list with ${centralLinksList.length} total links`
    );
  } catch (error) {
    console.error('✗ Error saving central links list:', error.message);
  }
}

// Function to determine documents to process based on scope
async function getDocumentsToProcess(collection) {
  const totalDocs = await collection.countDocuments();

  // Query for documents with non-empty arrays that might contain URLs
  // Skip documents where:
  // 1. backgrounds array is empty
  // 2. name key is not available or name key is empty string
  const queryForUrls = {
    $and: [
      // Ensure name exists and is not empty
      { name: { $exists: true, $ne: '', $ne: null } },
      // Ensure backgrounds array is not empty
      { 'backgrounds.0': { $exists: true } },
      // At least one of these arrays should have content
      {
        $or: [
          { 'backgrounds.0': { $exists: true } },
          { 'adultMaleVariations.0': { $exists: true } },
          { 'childMaleVariations.0': { $exists: true } },
          { 'adultFemaleVariations.0': { $exists: true } },
          { 'childFemaleVariations.0': { $exists: true } },
        ],
      },
    ],
  };

  const docsWithArrays = await collection.countDocuments(queryForUrls);

  if (SCOPE_CONFIG.type === PROCESSING_SCOPE.ALL) {
    console.log(`📋 Processing scope: ALL documents (${totalDocs} total)`);
    console.log(`📊 Documents with non-empty arrays: ${docsWithArrays}`);

    // If looking for URLs specifically, prioritize documents with arrays
    if (docsWithArrays > 0) {
      return {
        cursor: collection.find(queryForUrls),
        documentsToProcess: docsWithArrays,
        totalAvailable: totalDocs,
        note: 'Prioritizing documents with non-empty arrays',
      };
    } else {
      return {
        cursor: collection.find({}),
        documentsToProcess: totalDocs,
        totalAvailable: totalDocs,
        note: 'No documents with arrays found, processing all',
      };
    }
  } else {
    const limitedCount = Math.min(SCOPE_CONFIG.limit, totalDocs);
    console.log(
      `📋 Processing scope: LIMITED to ${limitedCount} documents (${totalDocs} total available)`
    );
    console.log(`📊 Documents with non-empty arrays: ${docsWithArrays}`);

    // If looking for URLs specifically, prioritize documents with arrays
    if (docsWithArrays > 0) {
      const arrayLimit = Math.min(limitedCount, docsWithArrays);
      return {
        cursor: collection.find(queryForUrls).limit(arrayLimit),
        documentsToProcess: arrayLimit,
        totalAvailable: totalDocs,
        note: `Prioritizing ${arrayLimit} documents with non-empty arrays`,
      };
    } else {
      return {
        cursor: collection.find({}).limit(limitedCount),
        documentsToProcess: limitedCount,
        totalAvailable: totalDocs,
        note: 'No documents with arrays found, using random selection',
      };
    }
  }
}

// Main function to process documents based on scope
async function processProductsCollection() {
  let client;

  try {
    // Reset central links list for fresh run
    centralLinksList = [];

    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log('✓ Connected to MongoDB successfully');

    // Get database and collection
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Ensure output directory exists
    const outputDir = await ensureOutputDirectory();

    // Get documents to process based on scope configuration
    const { cursor, documentsToProcess, totalAvailable, note } =
      await getDocumentsToProcess(collection);

    if (totalAvailable === 0) {
      console.log('No documents found in the collection.');
      return;
    }

    // Process documents
    let processedCount = 0;
    let totalUrlsExtracted = 0;

    while (
      (await cursor.hasNext()) &&
      (SCOPE_CONFIG.type === PROCESSING_SCOPE.ALL ||
        processedCount < SCOPE_CONFIG.limit)
    ) {
      const document = await cursor.next();

      if (!document._id) {
        console.warn('⚠ Document without _id found, skipping...');
        continue;
      }

      // Debug: Show document structure for first few documents
      if (DEBUG_CONFIG.enabled && processedCount < 3) {
        debugDocumentStructure(document, document._id.toString());
      }

      // Apply S3 URL transformations before extracting URLs
      const transformedDocument = replaceS3(document);

      // Extract HTTPS URLs from the transformed document
      const result = extractHttpsUrls(transformedDocument);
      const httpsUrls = result.urls;
      const debugInfo = result.debug;

      // Debug: Show extraction results
      if (DEBUG_CONFIG.enabled) {
        console.log(`📊 Document ${document._id.toString()} analysis:`);
        console.log(`   - Total fields scanned: ${debugInfo.totalFields}`);
        console.log(`   - String fields found: ${debugInfo.stringFields}`);
        console.log(`   - URLs extracted: ${debugInfo.urlsFound}`);

        // Show sample string values to debug what content exists
        console.log(
          `\n📝 Sample string content from document ${document._id.toString()}:`
        );
        let sampleCount = 0;
        const maxSamples = 5;

        function showSampleStrings(obj, path = '') {
          if (sampleCount >= maxSamples) return;

          for (const [key, value] of Object.entries(obj)) {
            if (sampleCount >= maxSamples) break;

            const fullPath = path ? `${path}.${key}` : key;

            if (typeof value === 'string' && value.length > 10) {
              console.log(
                `   ${fullPath}: "${value.substring(0, 100)}${
                  value.length > 100 ? '...' : ''
                }"`
              );
              sampleCount++;
            } else if (typeof value === 'object' && value !== null) {
              showSampleStrings(value, fullPath);
            }
          }
        }

        showSampleStrings(document);
        console.log('');
      }

      // Save to JSON file using document _id as filename
      const urlCount = await saveToJsonFile(
        document._id.toString(),
        httpsUrls,
        outputDir
      );

      processedCount++;
      totalUrlsExtracted += urlCount;

      // Progress update
      if (processedCount % 10 === 0 || processedCount === documentsToProcess) {
        console.log(
          `Progress: ${processedCount}/${documentsToProcess} documents processed (${totalAvailable} total available)`
        );
      }
    }

    // Save central links list
    await saveCentralLinksList(outputDir);

    console.log('\n🎉 Processing completed successfully!');
    console.log(`📊 Summary:`);
    console.log(
      `   - Processing scope: ${
        SCOPE_CONFIG.type === PROCESSING_SCOPE.ALL
          ? 'ALL'
          : `LIMITED to ${SCOPE_CONFIG.limit}`
      }`
    );
    console.log(`   - Documents processed: ${processedCount}`);
    console.log(`   - Total documents available: ${totalAvailable}`);
    console.log(`   - Total HTTPS URLs extracted: ${totalUrlsExtracted}`);
    console.log(`   - Individual files saved in: ${outputDir}`);
    console.log(`   - Central links list saved as: all_links_central.json`);
    console.log(`   - ${note}`);
  } catch (error) {
    console.error('❌ Error occurred:', error);

    if (error.code === 'ENOTFOUND') {
      console.error(
        'Could not connect to MongoDB. Please check your connection string.'
      );
    } else if (error.name === 'MongoServerError') {
      console.error(
        'MongoDB server error. Please check your database name and permissions.'
      );
    }
  } finally {
    // Close MongoDB connection
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

// Function to configure processing scope
function setProcessingScope(type, limit = null) {
  if (type === PROCESSING_SCOPE.ALL) {
    SCOPE_CONFIG.type = PROCESSING_SCOPE.ALL;
    console.log('✓ Configured to process ALL documents');
  } else if (type === PROCESSING_SCOPE.LIMITED && limit && limit > 0) {
    SCOPE_CONFIG.type = PROCESSING_SCOPE.LIMITED;
    SCOPE_CONFIG.limit = limit;
    console.log(`✓ Configured to process LIMITED to ${limit} documents`);
  } else {
    console.error(
      '❌ Invalid scope configuration. Use PROCESSING_SCOPE.ALL or PROCESSING_SCOPE.LIMITED with a positive limit.'
    );
  }
}

// Function to display usage instructions
function displayUsage() {
  console.log('📋 MongoDB HTTPS URL Extractor');
  console.log('================================');
  console.log('');
  console.log('🔧 Configuration Options:');
  console.log(
    `   - Current scope: ${
      SCOPE_CONFIG.type === PROCESSING_SCOPE.ALL
        ? 'ALL documents'
        : `LIMITED to ${SCOPE_CONFIG.limit} documents`
    }`
  );
  console.log(
    '   - To change scope, modify SCOPE_CONFIG in the code or use setProcessingScope() function'
  );
  console.log('');
  console.log('Before running this script, please:');
  console.log('1. Install required dependencies: npm install mongodb');
  console.log(
    '2. Update the MONGO_URI constant with your MongoDB connection string'
  );
  console.log('3. Update the DATABASE_NAME constant with your database name');
  console.log('4. Configure SCOPE_CONFIG for your desired processing scope');
  console.log('');
  console.log('The script will:');
  console.log('- Connect to your MongoDB database');
  console.log(
    `- Process documents based on scope: ${
      SCOPE_CONFIG.type === PROCESSING_SCOPE.ALL
        ? 'ALL'
        : `${SCOPE_CONFIG.limit} documents`
    }`
  );
  console.log(
    '- Extract all string values starting with "https" from nested objects'
  );
  console.log('- Save results to separate JSON files named by document _id');
  console.log('- Maintain a central list of all extracted links');
  console.log('- Create files in "./urls/" directory');
  console.log('- Save central links list as "all_links_central.json"');
  console.log('');
}

// Run the script
if (require.main === module) {
  displayUsage();
  processProductsCollection().catch(console.error);
}

module.exports = {
  extractHttpsUrls,
  processProductsCollection,
  setProcessingScope,
  PROCESSING_SCOPE,
  SCOPE_CONFIG,
};
