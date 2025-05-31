const fs = require('fs');
const path = require('path');
const https = require('https');
const getAllUrlsOfAllFiles = require('./getAllUrls');
const state = require('./config');

// Create base download directory if it doesn't exist
const baseDownloadDir = './svgs';
if (!fs.existsSync(baseDownloadDir)) {
  fs.mkdirSync(baseDownloadDir, { recursive: true });
}

// Use all URLs with their IDs
const fileUrls = getAllUrlsOfAllFiles.slice(state.downloadCount);

console.log('🚀 SVG Download Script Started');
console.log('='.repeat(50));
console.log(
  `📊 Current Progress: ${state.downloadCount} downloaded, ${state.failedCount} failed`
);
console.log(`📋 Total files available: ${getAllUrlsOfAllFiles.length}`);
console.log(`⏳ Files remaining to download: ${fileUrls.length}`);

if (fileUrls.length === 0) {
  console.log('✅ All files have been downloaded!');
  process.exit(0);
}

console.log(
  `🔄 ${state.downloadCount > 0 ? 'Resuming' : 'Starting'} download...`
);
console.log('='.repeat(50));

// Graceful shutdown handler
process.on('SIGINT', () => {
  console.log('\n⚠️  Received interruption signal. Saving progress...');
  console.log(
    `💾 Progress saved: ${state.downloadCount} downloaded, ${state.failedCount} failed`
  );
  console.log('🔄 Run the script again to resume from this point.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Received termination signal. Saving progress...');
  console.log(
    `💾 Progress saved: ${state.downloadCount} downloaded, ${state.failedCount} failed`
  );
  console.log('🔄 Run the script again to resume from this point.');
  process.exit(0);
});

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

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      console.log(`⏭️  Skipping existing file: ${id}/characters/${filename}`);
      resolve(filename);
      return;
    }

    const file = fs.createWriteStream(filePath);

    console.log(`⬇️  Downloading: ${filename} to ${id}/characters/`);

    const request = https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(filename);
        });
        file.on('error', (err) => {
          file.close();
          fs.unlink(filePath, () => {}); // Delete the incomplete file
          reject(new Error(`File write error: ${err.message}`));
        });
      } else if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirects
        file.close();
        fs.unlink(filePath, () => {});
        reject(new Error(`Redirect not handled: HTTP ${response.statusCode}`));
      } else {
        file.close();
        fs.unlink(filePath, () => {}); // Delete the file if download failed
        reject(
          new Error(
            `Failed to download ${filename}: HTTP ${response.statusCode}`
          )
        );
      }
    });

    request.on('error', (err) => {
      file.close();
      fs.unlink(filePath, () => {}); // Delete the file if download failed
      reject(new Error(`Network error: ${err.message}`));
    });

    // Set a timeout for the request
    request.setTimeout(30000, () => {
      request.destroy();
      file.close();
      fs.unlink(filePath, () => {});
      reject(new Error(`Download timeout for ${filename}`));
    });
  });
}

// Download all files with concurrency control
async function downloadAllFiles() {
  const maxConcurrentDownloads = 5; // Limit concurrent downloads to avoid overwhelming the server
  const initialDownloadCount = state.downloadCount;
  const initialFailedCount = state.failedCount;

  console.log(`Starting download of ${fileUrls.length} files...`);
  console.log(`Resuming from download #${initialDownloadCount + 1}`);
  console.log('='.repeat(50));

  for (let i = 0; i < fileUrls.length; i += maxConcurrentDownloads) {
    const batch = fileUrls.slice(i, i + maxConcurrentDownloads);
    const promises = batch.map(async (urlObj) => {
      try {
        const filename = getFilenameFromUrl(urlObj.url);
        await downloadFile(urlObj, filename);
        state.downloadCount++;
        console.log(
          `✓ Downloaded: ${urlObj.id}/characters/${filename} (Total: ${state.downloadCount})`
        );
      } catch (error) {
        console.error(`✗ Failed to download: ${urlObj.url}`);
        console.error(`  Error: ${error.message}`);
        state.failedCount++;
      }
    });

    await Promise.all(promises);

    // Show progress
    const processed = Math.min(i + maxConcurrentDownloads, fileUrls.length);
    const totalProcessed = initialDownloadCount + processed;
    console.log(
      `Progress: ${processed}/${fileUrls.length} files processed in this session`
    );
    console.log(
      `Overall Progress: ${state.downloadCount} successful, ${state.failedCount} failed`
    );
  }

  console.log('='.repeat(50));
  console.log(`Download session completed!`);
  console.log(
    `✓ Successfully downloaded in this session: ${
      state.downloadCount - initialDownloadCount
    } files`
  );
  console.log(
    `✗ Failed in this session: ${state.failedCount - initialFailedCount} files`
  );
  console.log(
    `📊 Total Progress: ${state.downloadCount} successful, ${state.failedCount} failed`
  );
  console.log(`📁 Files saved in: ${baseDownloadDir}/[id]/characters/`);

  // Save final state
  console.log(
    '💾 Progress saved. Script can be safely restarted to resume from this point.'
  );
}

// Start the download process
downloadAllFiles().catch(console.error);
