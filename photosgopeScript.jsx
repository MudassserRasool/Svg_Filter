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

// Main function to process SVG files
function main() {
    var scriptPath = getScriptPath();
    var svgsFolder = Folder(scriptPath + "/svgs");
    var styledSvgsFolder = Folder(scriptPath + "/styledSvgs");

    // Create styledSvgs folder if it doesn't exist
    if (!styledSvgsFolder.exists) {
        styledSvgsFolder.create();
    }

    if (!svgsFolder.exists) {
        alert("Error: 'svgs' folder not found in the script's directory.");
        return;
    }

    var svgFiles = svgsFolder.getFiles("*.svg");

    if (svgFiles.length === 0) {
        alert("No SVG files found in the 'svgs' folder.");
        return;
    }

    for (var i = 0; i < svgFiles.length; i++) {
        var svgFile = svgFiles[i];
        try {
            var doc = app.open(svgFile);

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
            var saveFile = File(styledSvgsFolder + "/" + svgFile.name.replace(/\\.svg$/i, ".png"));
            doc.saveAs(saveFile, saveOptions, true, Extension.LOWERCASE);
            doc.close(SaveOptions.DONOTSAVECHANGES);

        } catch (e) {
            alert("Error processing file " + svgFile.name + ": " + e.message);
        }
    }
    alert("SVG processing complete. Styled SVGs saved in 'styledSvgs' folder.");
}

// Run the main function 
main();