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
  }
};