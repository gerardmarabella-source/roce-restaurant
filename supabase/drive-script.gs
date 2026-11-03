// Google Apps Script: guarda en una carpeta de Drive los PDF (facturas) que envía
// la función de Supabase. Se despliega una sola vez con la cuenta de Google
// dueña de la carpeta (ver supabase/LEEME.md).
//
// 1) script.google.com → Nuevo proyecto → pega este código.
// 2) Configuración del proyecto (engranaje) → Propiedades del script → añade:
//      DRIVE_TOKEN  = un texto largo inventado (el mismo que DRIVE_SCRIPT_TOKEN en Supabase)
// 3) Implementar → Nueva implementación → Aplicación web:
//      Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier usuario
//    y acepta los permisos de Drive. Copia la URL que termina en /exec.
var FOLDER_ID = '1wCs6epYXin8uHGo-UyWLSW5sTZASeuKu';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var token = PropertiesService.getScriptProperties().getProperty('DRIVE_TOKEN');
    if (!token || body.token !== token) return out_({ ok: false, error: 'forbidden' });
    if (!body.name || !body.data) return out_({ ok: false, error: 'bad request' });
    var name = String(body.name).replace(/[^\w.\-]/g, '_');
    var blob = Utilities.newBlob(Utilities.base64Decode(body.data), body.mime || 'application/pdf', name);
    var folder = DriveApp.getFolderById(FOLDER_ID);
    var existing = folder.getFilesByName(name);
    var file = existing.hasNext() ? existing.next() : folder.createFile(blob);
    return out_({ ok: true, url: file.getUrl() });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
