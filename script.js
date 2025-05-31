const fs = require('fs');
const path = require('path');
const https = require('https');
const getAllUrlsOfAllFiles = require('./getAllUrls');

// Create base download directory if it doesn't exist
const baseDownloadDir = './svgs';
if (!fs.existsSync(baseDownloadDir)) {
  fs.mkdirSync(baseDownloadDir, { recursive: true });
}

// Use all URLs with their IDs
const fileUrls = getAllUrlsOfAllFiles;

console.log(`Found ${fileUrls.length} files to download.`);

// Function to extract filename from URL
function getFilenameFromUrl(url) {
  const urlParts = url.split('/');
  let filename = urlParts[urlParts.length - 1];

  // Clean up URL encoding first
  filename = decodeURIComponent(filename);

  // Find the actual file extension and remove everything after it
  // Look for common file extensions
  const extensionMatch = filename.match(
    /\.(svg|png|jpg|jpeg|gif|webp|ico|pdf|eps|ai|psd)/i
  );
  if (extensionMatch) {
    const extensionIndex = filename.indexOf(extensionMatch[0]);
    const extension = extensionMatch[0];
    // Keep only the part up to and including the extension
    filename = filename.substring(0, extensionIndex + extension.length);
  }

  // Remove duplicate extensions if any (keep this logic for safety)
  const finalExtensionMatch = filename.match(/\.([a-zA-Z0-9]+)$/);
  if (finalExtensionMatch) {
    const extension = finalExtensionMatch[1];
    const duplicatePattern = new RegExp(`\\.${extension}\\.${extension}$`);
    if (duplicatePattern.test(filename)) {
      filename = filename.replace(duplicatePattern, `.${extension}`);
    }
  }

  // Replace invalid characters for filesystem
  filename = filename.replace(/[<>:"/\\|?*]/g, '_');

  return filename;
}

// Function to create directory structure for an ID
function createDirectoryStructure(id) {
  const idDir = path.join(baseDownloadDir, id);
  const charactersDir = path.join(idDir, 'characters');

  if (!fs.existsSync(idDir)) {
    fs.mkdirSync(idDir, { recursive: true });
  }

  if (!fs.existsSync(charactersDir)) {
    fs.mkdirSync(charactersDir, { recursive: true });
  }

  return charactersDir;
}

// Function to download a file
function downloadFile(urlObj, filename) {
  return new Promise((resolve, reject) => {
    const { url, id } = urlObj;

    // Create the directory structure and get the characters folder path
    const charactersDir = createDirectoryStructure(id);
    const filePath = path.join(charactersDir, filename);
    const file = fs.createWriteStream(filePath);

    console.log(`Downloading: ${filename} to ${id}/characters/`);

    https
      .get(url, (response) => {
        if (response.statusCode === 200) {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log(`✓ Downloaded: ${id}/characters/${filename}`);
            resolve(filename);
          });
        } else {
          file.close();
          fs.unlink(filePath, () => {}); // Delete the file if download failed
          reject(
            new Error(
              `Failed to download ${filename}: HTTP ${response.statusCode}`
            )
          );
        }
      })
      .on('error', (err) => {
        file.close();
        fs.unlink(filePath, () => {}); // Delete the file if download failed
        reject(err);
      });
  });
}

// Download all files with concurrency control
async function downloadAllFiles() {
  const maxConcurrentDownloads = 5; // Limit concurrent downloads to avoid overwhelming the server
  let downloadedCount = 0;
  let failedCount = 0;

  console.log(`Starting download of ${fileUrls.length} files...`);
  console.log('='.repeat(50));

  for (let i = 0; i < fileUrls.length; i += maxConcurrentDownloads) {
    const batch = fileUrls.slice(i, i + maxConcurrentDownloads);
    const promises = batch.map(async (urlObj) => {
      try {
        const filename = getFilenameFromUrl(urlObj.url);
        await downloadFile(urlObj, filename);
        downloadedCount++;
      } catch (error) {
        console.error(`✗ Failed to download: ${urlObj.url}`);
        console.error(`  Error: ${error.message}`);
        failedCount++;
      }
    });

    await Promise.all(promises);

    // Show progress
    const processed = Math.min(i + maxConcurrentDownloads, fileUrls.length);
    console.log(`Progress: ${processed}/${fileUrls.length} files processed`);
  }

  console.log('='.repeat(50));
  console.log(`Download completed!`);
  console.log(`✓ Successfully downloaded: ${downloadedCount} files`);
  console.log(`✗ Failed downloads: ${failedCount} files`);
  console.log(`📁 Files saved in: ${baseDownloadDir}/[id]/characters/`);
}

// Start the download process
downloadAllFiles().catch(console.error);
