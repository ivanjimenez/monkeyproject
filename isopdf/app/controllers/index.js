var pdf_module = require("com.pdfreader.my");
var f = Ti.Filesystem.getFile(Ti.Filesystem.externalStorageDirectory, "iso.pdf");

// Aquí tienes que cambiar la ruta por tu archivo, sería /sdcard/archivo.pdf, 
// si por ejemplo guardas "archivo.pdf" en la ruta raíz de la sdcard de un dispositivo android
pdf_module.ShowPdfFromFile('/sdcard/iso.pdf');


console.log("test1: " + JSON.stringify(f));
$.win.open();
