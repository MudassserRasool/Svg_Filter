const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');
// mongodb+srv://ameershah:wasiameer%40001@cactusdb.q95tc.mongodb.net/cactus
// MongoDB connection configuration
const MONGO_URI =
  'mongodb+srv://ameershah:wasiameer%40001@cactusdb.q95tc.mongodb.net'; // Update with your MongoDB URI
const DATABASE_NAME = 'cactus'; // Update with your database name
const COLLECTION_NAME = 'products';

const DOWNLOAD_AMOUNT = {
  ALL: 'all',
  FEW: 2,
};

const NUMBER_OF_DOCUMENTS_TO_PROCESS_AND_SAVE_LINKS_ON_THOSE_DOCUMENTS =
  DOWNLOAD_AMOUNT.FEW;

// Function to recursively extract HTTPS URLs from nested objects
function extractHttpsUrls(obj, currentPath = '') {
  const httpsUrls = {};

  if (typeof obj !== 'object' || obj === null) {
    return httpsUrls;
  }

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = currentPath ? `${currentPath}.${key}` : key;

    if (typeof value === 'string' && value.startsWith('https')) {
      httpsUrls[fullPath] = value;
    } else if (typeof value === 'object' && value !== null) {
      // Recursively process nested objects and arrays
      const nestedUrls = extractHttpsUrls(value, fullPath);
      Object.assign(httpsUrls, nestedUrls);
    }
  }

  return httpsUrls;
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
  } catch (error) {
    console.error(
      `✗ Error saving file for document ${documentId}:`,
      error.message
    );
  }
}

// Main function to process all documents
async function processProductsCollection() {
  let client;

  try {
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

    // Get total document count for progress tracking
    const totalDocs = await collection.countDocuments();
    console.log(
      `Found ${totalDocs} documents in ${COLLECTION_NAME} collection`
    );

    if (totalDocs === 0) {
      console.log('No documents found in the collection.');
      return;
    }

    // Process documents in batches to avoid memory issues
    const batchSize = 100;
    let processedCount = 0;
    let totalUrlsExtracted = 0;

    const cursor = collection.find({});

    while (await cursor.hasNext()) {
      const document = await cursor.next();

      if (!document._id) {
        console.warn('⚠ Document without _id found, skipping...');
        continue;
      }

      // Extract HTTPS URLs from the document
      const httpsUrls = extractHttpsUrls(document);

      // Save to JSON file using document _id as filename
      await saveToJsonFile(document._id.toString(), httpsUrls, outputDir);

      processedCount++;
      totalUrlsExtracted += Object.keys(httpsUrls).length;

      // Progress update
      if (processedCount % 10 === 0 || processedCount === totalDocs) {
        console.log(
          `Progress: ${processedCount}/${totalDocs} documents processed`
        );
      }
    }

    console.log('\n🎉 Processing completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Documents processed: ${processedCount}`);
    console.log(`   - Total HTTPS URLs extracted: ${totalUrlsExtracted}`);
    console.log(`   - Files saved in: ${outputDir}`);
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

// Function to display usage instructions
function displayUsage() {
  console.log('📋 MongoDB HTTPS URL Extractor');
  console.log('================================');
  console.log('');
  console.log('Before running this script, please:');
  console.log('1. Install required dependencies: npm install mongodb');
  console.log(
    '2. Update the MONGO_URI constant with your MongoDB connection string'
  );
  console.log('3. Update the DATABASE_NAME constant with your database name');
  console.log('');
  console.log('The script will:');
  console.log('- Connect to your MongoDB database');
  console.log('- Process all documents in the "products" collection');
  console.log(
    '- Extract all string values starting with "https" from nested objects'
  );
  console.log('- Save results to separate JSON files named by document _id');
  console.log('- Create files in "./urls/" directory');
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
};
