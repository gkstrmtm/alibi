import fs from 'fs';
import path from 'path';

const historyDir = 'C:\\Users\\tabar\\AppData\\Roaming\\Code\\User\\History';

function findLatestFile() {
    let latestFile = null;
    let latestTime = 0;

    function walk(dir) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(fullPath);
                } else if (entry.isFile()) {
                    try {
                        const stats = fs.statSync(fullPath);
                        // Read first to avoid unnecessary buffering if not a text file, but here we expect history files to be readable
                        const content = fs.readFileSync(fullPath, 'utf8');
                        
                        if (content.includes('OutputScreen') && content.includes('styles.canvasSideColumn')) {
                            const lineCount = content.split('\n').length;
                            if (lineCount > 1000) {
                                if (stats.mtimeMs > latestTime) {
                                    latestTime = stats.mtimeMs;
                                    latestFile = fullPath;
                                }
                            }
                        }
                    } catch (err) {
                        // ignore read errors (e.g., locks)
                    }
                }
            }
        } catch (err) {
            // ignore dir errors
        }
    }

    walk(historyDir);

    if (latestFile) {
        console.log("FOUND_PATH: " + latestFile);
    } else {
        console.log("No file found matching the criteria.");
    }
}

findLatestFile();
