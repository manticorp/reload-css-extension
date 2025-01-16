const AdmZip = require("adm-zip");
const zip = new AdmZip();

zip.addLocalFile("manifest.json");
zip.addLocalFolder("options", '/options');
zip.addLocalFolder("scripts", '/scripts');
zip.addLocalFolder("images", '/images');
zip.deleteFile("images/icon.ai");

zip.writeZip("easy-css-reload.zip");