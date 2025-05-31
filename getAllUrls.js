const fs = require('fs');
const path = require('path');

/**
 * Reads all JSON files from the urls folder and merges their arrays into one array
 * Each URL object includes the original URL and the ID from the filename
 * @returns {Array} Combined array of all URLs with their corresponding IDs
 */
function getAllUrls() {
  try {
    const urlsDir = path.join(__dirname, 'urls');

    // Check if urls directory exists
    if (!fs.existsSync(urlsDir)) {
      console.error('URLs directory not found');
      return [];
    }

    // Read all files from urls directory
    const files = fs.readdirSync(urlsDir);

    // Filter only JSON files
    const jsonFiles = files.filter(
      (file) => path.extname(file).toLowerCase() === '.json'
    );

    if (jsonFiles.length === 0) {
      console.log('No JSON files found in urls directory');
      return [];
    }

    const allUrls = [];
    let processedFiles = 0;
    let errorFiles = 0;

    // Process each JSON file
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(urlsDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf8');

        // Extract ID from filename (remove .json extension)
        const id = path.basename(file, '.json');

        // Parse JSON content
        const urlArray = JSON.parse(fileContent);

        // Validate that it's an array
        if (Array.isArray(urlArray)) {
          // Add each URL with its corresponding ID
          urlArray.forEach((url) => {
            allUrls.push({
              url: url,
              id: id,
            });
          });
          processedFiles++;
        } else {
          console.warn(`File ${file} does not contain an array, skipping...`);
          errorFiles++;
        }
      } catch (error) {
        console.error(`Error processing file ${file}:`, error.message);
        errorFiles++;
      }
    }

    console.log(`Successfully processed ${processedFiles} files`);
    if (errorFiles > 0) {
      console.log(`${errorFiles} files had errors and were skipped`);
    }
    console.log(`Total URLs merged: ${allUrls.length}`);

    return allUrls;
  } catch (error) {
    console.error('Error in getAllUrls function:', error.message);
    return [];
  }
}

/**
 * Async version of getAllUrls function for better performance with large files
 * @returns {Promise<Array>} Combined array of all URLs with their corresponding IDs
 */
async function getAllUrlsAsync() {
  try {
    const urlsDir = path.join(__dirname, 'urls');

    // Check if urls directory exists
    if (!fs.existsSync(urlsDir)) {
      console.error('URLs directory not found');
      return [];
    }

    // Read all files from urls directory
    const files = await fs.promises.readdir(urlsDir);

    // Filter only JSON files
    const jsonFiles = files.filter(
      (file) => path.extname(file).toLowerCase() === '.json'
    );

    if (jsonFiles.length === 0) {
      console.log('No JSON files found in urls directory');
      return [];
    }

    const allUrls = [];
    let processedFiles = 0;
    let errorFiles = 0;

    // Process files in parallel for better performance
    const filePromises = jsonFiles.map(async (file) => {
      try {
        const filePath = path.join(urlsDir, file);
        const fileContent = await fs.promises.readFile(filePath, 'utf8');

        // Extract ID from filename (remove .json extension)
        const id = path.basename(file, '.json');

        // Parse JSON content
        const urlArray = JSON.parse(fileContent);

        // Validate that it's an array
        if (Array.isArray(urlArray)) {
          const urlsWithId = urlArray.map((url) => ({
            url: url,
            id: id,
          }));
          return { success: true, urls: urlsWithId, file };
        } else {
          console.warn(`File ${file} does not contain an array, skipping...`);
          return { success: false, file };
        }
      } catch (error) {
        console.error(`Error processing file ${file}:`, error.message);
        return { success: false, file };
      }
    });

    // Wait for all files to be processed
    const results = await Promise.all(filePromises);

    // Merge all successful results
    for (const result of results) {
      if (result.success) {
        allUrls.push(...result.urls);
        processedFiles++;
      } else {
        errorFiles++;
      }
    }

    console.log(`Successfully processed ${processedFiles} files`);
    if (errorFiles > 0) {
      console.log(`${errorFiles} files had errors and were skipped`);
    }
    console.log(`Total URLs merged: ${allUrls.length}`);

    return allUrls;
  } catch (error) {
    console.error('Error in getAllUrlsAsync function:', error.message);
    return [];
  }
}

/**
 * Get unique URLs only (removes duplicates) while preserving ID information
 * @returns {Array} Array of unique URL objects with IDs
 */
function getUniqueUrls() {
  const allUrls = getAllUrls();
  const seen = new Set();
  const uniqueUrls = [];

  allUrls.forEach((urlObj) => {
    if (!seen.has(urlObj.url)) {
      seen.add(urlObj.url);
      uniqueUrls.push(urlObj);
    }
  });

  console.log(`Total URLs: ${allUrls.length}`);
  console.log(`Unique URLs: ${uniqueUrls.length}`);
  console.log(`Duplicates removed: ${allUrls.length - uniqueUrls.length}`);

  return uniqueUrls;
}

/**
 * Async version of getUniqueUrls
 * @returns {Promise<Array>} Array of unique URL objects with IDs
 */
async function getUniqueUrlsAsync() {
  const allUrls = await getAllUrlsAsync();
  const seen = new Set();
  const uniqueUrls = [];

  allUrls.forEach((urlObj) => {
    if (!seen.has(urlObj.url)) {
      seen.add(urlObj.url);
      uniqueUrls.push(urlObj);
    }
  });

  console.log(`Total URLs: ${allUrls.length}`);
  console.log(`Unique URLs: ${uniqueUrls.length}`);
  console.log(`Duplicates removed: ${allUrls.length - uniqueUrls.length}`);

  return uniqueUrls;
}

// Export functions
module.exports = {
  getAllUrls,
  getAllUrlsAsync,
  getUniqueUrls,
  getUniqueUrlsAsync,
};

// Example usage (uncomment to test):
console.log('Testing getAllUrls...');
const getAllUrlsOfAllFiles = getAllUrls();
console.log(`Found ${getAllUrlsOfAllFiles.length} total URLs`);
module.exports = getAllUrlsOfAllFiles;
// Example async usage:
// (async () => {
//   console.log('Testing getAllUrlsAsync...');
//   const urls = await getAllUrlsAsync();
//   console.log(`Found ${urls.length} total URLs`);
//   return urls;
// })();
