const fs=require('fs'),vm=require('vm');const h=fs.readFileSync(process.argv[2],'utf8');let n=0;
for(const m of h.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)){n++;new vm.Script(m[1]);}
const j=h.match(/<script id="level-data" type="application\/json">([\s\S]*?)<\/script>/);if(j)JSON.parse(j[1]);
console.log('scripts compiled:',n,'| level JSON ok');
