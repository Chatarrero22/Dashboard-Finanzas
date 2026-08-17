var fs = require('fs');
var path = require('path');
var XLSX = require('xlsx');
var csvParse = require('csv-parse/sync').parse;
var PDFParse = require('pdf-parse').PDFParse;

var DATE_KEYS = ['fecha', 'date', 'fecha operacion', 'fecha_operacion', 'dia'];
var DESC_KEYS = ['descripcion', 'description', 'detalle', 'concepto', 'comercio', 'movimiento'];
var AMOUNT_KEYS = ['monto', 'importe', 'amount', 'total', 'valor', 'debito', 'credito'];

function normalizeKey(k) {
  return String(k || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function pick(row, candidates) {
  var keys = Object.keys(row);
  for (var i = 0; i < keys.length; i++) {
    if (candidates.indexOf(normalizeKey(keys[i])) !== -1) return row[keys[i]];
  }
  return null;
}

function parseAmount(value) {
  if (typeof value === 'number') return value;
  var s = String(value || '').trim();
  if (!s) return 0;
  var negative = /^\(.*\)$/.test(s) || s.indexOf('-') !== -1;
  s = s.replace(/[^0-9.,]/g, '');
  // Formato argentino: 1.234,56 -> 1234.56
  if (s.indexOf(',') !== -1 && s.lastIndexOf(',') > s.lastIndexOf('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  var n = parseFloat(s);
  if (isNaN(n)) return 0;
  return negative ? -Math.abs(n) : n;
}

function parseDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  var s = String(value || '').trim();
  var dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    var year = dmy[3].length === 2 ? '20' + dmy[3] : dmy[3];
    return year + '-' + dmy[2].padStart(2, '0') + '-' + dmy[1].padStart(2, '0');
  }
  var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  return new Date().toISOString().slice(0, 10);
}

function rowsToTransactions(rows) {
  return rows
    .map(function (row) {
      var desc = pick(row, DESC_KEYS);
      var amount = parseAmount(pick(row, AMOUNT_KEYS));
      if (!desc || !amount) return null;
      return {
        date: parseDate(pick(row, DATE_KEYS)),
        description: String(desc).trim(),
        amount: amount
      };
    })
    .filter(Boolean);
}

function parseCSV(buffer) {
  var rows = csvParse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true
  });
  return rowsToTransactions(rows);
}

function parseXLSX(buffer) {
  var wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  var sheet = wb.Sheets[wb.SheetNames[0]];
  var rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return rowsToTransactions(rows);
}

async function pdfToText(buffer) {
  var parser = new PDFParse({ data: buffer });
  try {
    var result = await parser.getText();
    return result.text || '';
  } finally {
    if (typeof parser.destroy === 'function') await parser.destroy();
  }
}

// Extrae lineas del estilo "12/03/2026  DISCO SUPERMERCADO  -12.345,67"
async function parsePDF(buffer) {
  var text = await pdfToText(buffer);
  var out = [];
  text.split(/\r?\n/).forEach(function (line) {
    var m = line.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(.+?)\s+(-?[\d.,]+)\s*$/);
    if (!m) return;
    var amount = parseAmount(m[3]);
    if (!amount) return;
    out.push({
      date: parseDate(m[1]),
      description: m[2].trim().replace(/\s{2,}/g, ' '),
      amount: amount
    });
  });
  return out;
}

async function parseFile(filePath, originalName) {
  var buffer = fs.readFileSync(filePath);
  var ext = path.extname(originalName || filePath).toLowerCase();

  if (ext === '.csv' || ext === '.txt') return parseCSV(buffer);
  if (ext === '.xlsx' || ext === '.xls') return parseXLSX(buffer);
  if (ext === '.pdf') return parsePDF(buffer);
  throw new Error('Formato no soportado: ' + ext);
}

module.exports = {
  parseFile: parseFile,
  parseCSV: parseCSV,
  parseXLSX: parseXLSX,
  parsePDF: parsePDF,
  pdfToText: pdfToText,
  parseAmount: parseAmount,
  parseDate: parseDate
};
