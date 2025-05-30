#target photoshop

function convertToSmartObject(layer) {
    try {
        // First, create a new group/layer set
        var doc = app.activeDocument;
        var newGroup = doc.layerSets.add();
        newGroup.name = layer.name + "_Group";
        layer.move(newGroup, ElementPlacement.INSIDE);
        doc.activeLayer = newGroup;
        var idnewPlacedLayer = stringIDToTypeID("newPlacedLayer");
        executeAction(idnewPlacedLayer, undefined, DialogModes.NO);
    } catch (error) {
        alert("Error converting to Smart Object: " + error);
    }
}

function applyOilPaint() {
    try {
        var idOlnP = stringIDToTypeID("oilPaint");
        var desc = new ActionDescriptor();
        desc.putDouble(stringIDToTypeID("stylization"), 4.5);
        desc.putDouble(stringIDToTypeID("cleanliness"), 4.0);
        desc.putDouble(stringIDToTypeID("brushScale"), 0.5);
        desc.putDouble(stringIDToTypeID("microBrush"), 0.6);
        desc.putBoolean(stringIDToTypeID("lightingOn"), true);
        desc.putInteger(stringIDToTypeID("lightDirection"), -60);
        desc.putDouble(stringIDToTypeID("specularity"), 1.5);
        desc.putBoolean(stringIDToTypeID("preview"), false);
        executeAction(idOlnP, desc, DialogModes.NO);
    } catch (e) {
        alert("Oil Paint filter could not be applied. It might not be available in your version of Photoshop. Error: " + e.message);
    }
}

function processSVGFolders() {
    var doc = app.activeDocument;

    
    // Check if any layer sets exist, create one if not
    if (doc.layerSets.length === 0) {
       
        for (var k = 0; k < doc.artLayers.length; k++) {
            var singleLayer = doc.artLayers[k];
            
            if (singleLayer.isBackgroundLayer) {
                continue;
            }
            
            convertToSmartObject(singleLayer);
            
            applyOilPaint();
        }
        return;
    }

    // Process existing layer sets
    for (var i = 0; i < doc.layerSets.length; i++) {
        var folder = doc.layerSets[i];

        for (var j = 0; j < folder.artLayers.length; j++) {
            var layer = folder.artLayers[j];

            if (layer.isBackgroundLayer) {
                continue;
            }

            convertToSmartObject(layer);

            applyOilPaint();
        }
    }
}



// Function to get the script's path
function getScriptPath() {
    try {
        return app.activeScript.path;
    } catch (e) {
        return File($.fileName).path;
    }
}

// Main function to process any image files
function main() {
    var scriptPath = getScriptPath();
    var inputFolder = Folder(scriptPath + "/svgs");
    var styledFolder = Folder(scriptPath + "/styledSvgs");

    // Create styled folder if it doesn't exist
    if (!styledFolder.exists) {
        styledFolder.create();
    }

    if (!inputFolder.exists) {
        alert("Error: 'input' folder not found in the script's directory.");
        return;
    }

    // Get all image files (common formats supported by Photoshop)
    var imageFiles = inputFolder.getFiles(function(file) {
        if (file instanceof Folder) return false;
        var name = file.name.toLowerCase();
        return name.match(/\.(svg|png|jpg|jpeg|gif|bmp|tiff|tif|psd|ai|eps|pdf)$/);
    });

    if (imageFiles.length === 0) {
        alert("No supported image files found in the 'input' folder.");
        return;
    }

    for (var i = 0; i < imageFiles.length; i++) {
        var imageFile = imageFiles[i];
        try {
            var doc = app.open(imageFile);

            // Process layers
            if (doc.artLayers.length > 0) {
                 for (var k = 0; k < doc.artLayers.length; k++) {
                    var singleLayer = doc.artLayers[k];
                    if (singleLayer.isBackgroundLayer) {
                        continue;
                    }
                    // Unlock the layer if it's locked
                    if (singleLayer.allLocked) {
                        singleLayer.allLocked = false;
                    }
                     if (singleLayer.pixelsLocked) {
                        singleLayer.pixelsLocked = false;
                    }
                    if (singleLayer.positionLocked) {
                        singleLayer.positionLocked = false;
                    }
                    if (singleLayer.transparentPixelsLocked) {
                        singleLayer.transparentPixelsLocked = false;
                    }
                    convertToSmartObject(singleLayer);
                    applyOilPaint();
                }
            }

            // Save the processed file
            var saveOptions = new PNGSaveOptions();
            saveOptions.compression = 9; 
            // Get the base name without extension and add .png
            var baseName = imageFile.name.replace(/\.[^\.]+$/, "");
            var saveFile = File(styledFolder + "/" + baseName + ".png");
            doc.saveAs(saveFile, saveOptions, true, Extension.LOWERCASE);
            doc.close(SaveOptions.DONOTSAVECHANGES);

        } catch (e) {
            alert("Error processing file " + imageFile.name + ": " + e.message);
        }
    }
    alert("Image processing complete. Styled images saved in 'styled' folder.");
}

// Run the main function 
main();