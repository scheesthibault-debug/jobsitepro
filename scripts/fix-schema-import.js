const fs = require('fs');
const src = 'c:/Users/schee/Downloads/pb_schema (3).json';
const dst = 'c:/Users/schee/Desktop/chantiertrack-v2/chantiertrack-v2/pocketbase/pb_schema-import.json';
let s = fs.readFileSync(src, 'utf8');
s = s.replace('" employee_pocket"', '"employee_pocket"');
fs.writeFileSync(dst, s);
console.log('Written', dst);
