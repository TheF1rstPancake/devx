const database = require('../server/database');
const fs = require('fs');

const DATA_PATH = `${ __dirname }/data`;

function writeToFile(filename, data) {
  return new Promise((resolve, reject) => {
    var full_filename = `${ DATA_PATH }/${ filename }`;
    fs.writeFile(full_filename, data, (err) => {
      if (err !== undefined && err !== null) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

module.exports = {
  toCsv: function(data) {
    
    var out = [];
    var header = Object.keys(data[0]).join(', ');
    out.push(header);
    
    
    for (var i in data) {
      var row = Object.values(data[i]).join(', ');
      out.push(row);
    }
    return out.join('\n');
  },
  sortData: function(data) {
    var d = data.sort((a, b) => {
      return a._id > b._id ? 1 : a._id === b._id ? 0 : -1;
    });
    return d;
  },
  writeToFile: writeToFile,
  run: async function(script) {
    console.log('Running script');
    try {
      var db = await database.get();
      var results = await script(db);
      console.log(results);
      process.exit(0);
    } catch (err) {
      console.log('ERR: ', err);
      process.exit(1);
    }
  }
};