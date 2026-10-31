import { strToU8, zipSync } from 'fflate';
import { colIndex, colName, readCsv, readXlsx, sheetNames, writeXlsx } from './xlsx';

describe('xlsx', () => {
  it('names columns both ways', () => {
    expect([0, 25, 26, 27, 701].map(colName)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ']);
    expect(['A1', 'Z9', 'AA3', 'ZZ10'].map(colIndex)).toEqual([0, 25, 26, 701]);
  });

  it('makes sheet names Excel accepts', () => {
    expect(sheetNames(['Dishes', 'dishes', 'A/B: list?', 'x'.repeat(40)])).toEqual(['Dishes', 'dishes 2', 'A B  list', 'x'.repeat(31)]);
  });

  it('round-trips text, numbers, booleans and gaps', () => {
    const rows = [['Dish', 'Price', 'Shown'], ['Raj Kachori & "Chaat"', 60, true], [null, 45.5, false], ['ગુજરાતી ₹', null, null]];
    const back = readXlsx(writeXlsx([{ name: 'Dishes', rows }, { name: 'Empty', rows: [] }]));
    expect(back.map(s => s.name)).toEqual(['Dishes', 'Empty']);
    expect(back[0].rows).toEqual([['Dish', 'Price', 'Shown'], ['Raj Kachori & "Chaat"', 60, true], [null, 45.5, false], ['ગુજરાતી ₹']]);
    expect(back[1].rows).toEqual([]);
  });

  it('reads shared strings and skipped rows the way Excel saves them', () => {
    const x = (s: string) => strToU8(`<?xml version="1.0"?>${s}`);
    const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
    const file = zipSync({
      'xl/workbook.xml': x(`<workbook ${ns} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Menu" sheetId="1" r:id="rId3"/></sheets></workbook>`),
      'xl/_rels/workbook.xml.rels': x('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId3" Target="/xl/worksheets/s.xml"/></Relationships>'),
      'xl/sharedStrings.xml': x(`<sst ${ns}><si><t>Dish</t></si><si><r><t>Pani </t></r><r><t>Puri</t></r></si></sst>`),
      'xl/worksheets/s.xml': x(`<worksheet ${ns}><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="3"><c r="B3" t="s"><v>1</v></c><c r="C3"><v>40</v></c></row></sheetData></worksheet>`),
    });
    expect(readXlsx(file)).toEqual([{ name: 'Menu', rows: [['Dish'], [], [null, 'Pani Puri', 40]] }]);
  });

  it('reads quoted CSV', () => {
    expect(readCsv('﻿Name,Price\r\n"Dahi, Puri",50\n"Say ""hi""\nthere",\n')).toEqual([['Name', 'Price'], ['Dahi, Puri', '50'], ['Say "hi"\nthere', '']]);
  });
});
