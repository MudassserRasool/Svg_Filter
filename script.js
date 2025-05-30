const fs = require('fs');
const path = require('path');
const https = require('https');

// Create download directory if it doesn't exist
const downloadDir = './svgs';
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir, { recursive: true });
}

// Read the images links JSON file
const imageLinksData = JSON.parse(fs.readFileSync('images_links.json', 'utf8'));

// Filter only SVG files
const svgUrls = imageLinksData.filter((url) =>
  url.toLowerCase().endsWith('.svg')
);

console.log(
  `Found ${svgUrls.length} SVG files to download out of ${imageLinksData.length} total files.`
);

// Function to extract filename from URL
function getFilenameFromUrl(url) {
  const urlParts = url.split('/');
  let filename = urlParts[urlParts.length - 1];

  // Remove duplicate extensions if any (like .svg.svg)
  if (filename.endsWith('.svg.svg')) {
    filename = filename.replace('.svg.svg', '.svg');
  }

  // Clean up URL encoding
  filename = decodeURIComponent(filename);

  // Replace invalid characters for filesystem
  filename = filename.replace(/[<>:"/\\|?*]/g, '_');

  return filename;
}

// Function to download a file
function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(downloadDir, filename);
    const file = fs.createWriteStream(filePath);

    console.log(`Downloading: ${filename}`);

    https
      .get(url, (response) => {
        if (response.statusCode === 200) {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log(`✓ Downloaded: ${filename}`);
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

// Download all SVG files with concurrency control
async function downloadAllSvgs() {
  const maxConcurrentDownloads = 5; // Limit concurrent downloads to avoid overwhelming the server
  let downloadedCount = 0;
  let failedCount = 0;

  console.log(`Starting download of ${svgUrls.length} SVG files...`);
  console.log('='.repeat(50));

  for (let i = 0; i < svgUrls.length; i += maxConcurrentDownloads) {
    const batch = svgUrls.slice(i, i + maxConcurrentDownloads);
    const promises = batch.map(async (url) => {
      try {
        const filename = getFilenameFromUrl(url);
        await downloadFile(url, filename);
        downloadedCount++;
      } catch (error) {
        console.error(`✗ Failed to download: ${url}`);
        console.error(`  Error: ${error.message}`);
        failedCount++;
      }
    });

    await Promise.all(promises);

    // Show progress
    const processed = Math.min(i + maxConcurrentDownloads, svgUrls.length);
    console.log(`Progress: ${processed}/${svgUrls.length} files processed`);
  }

  console.log('='.repeat(50));
  console.log(`Download completed!`);
  console.log(`✓ Successfully downloaded: ${downloadedCount} files`);
  console.log(`✗ Failed downloads: ${failedCount} files`);
  console.log(`📁 Files saved in: ${downloadDir}`);
}

// Start the download process
downloadAllSvgs().catch(console.error);