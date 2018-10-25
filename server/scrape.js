const axios = require('axios');
const database = require('./database');
const Promise = require('bluebird');
const stackoverflow = require('./stackoverflow');


async function bulkWriteDocuments(collection, bulkWrite, options) {
  options = options === undefined || options === null ? {} : options;

  // write the data to Mongo and set up the next search
  console.log(`Writing ${ bulkWrite.length } documents`);
  try {
    await collection.bulkWrite(bulkWrite, { ordered: false });
    console.log(`Wrote ${ bulkWrite.length } documents`);

  } catch (err) {
    console.log('Issue bulk writing documents: ', err); 
  }
 
  // we can optionally choose to return failed writes
  // by default, we will return an empty list
  // if this is true, then we will return all of the failed documents so that the next write can try
  if (options.return_failed_writes !== true) {
    bulkWrite = [];
  }

  return bulkWrite;
}

async function scrape_product(mongo, product_name, options) {
  options = options === undefined ? {} : options;
 
   // get the StackOverflow collection and ensure we've given it the right indeces
  var collection = await mongo.collection('StackOverflow');

  // initialize variables
  var has_more = true;
  var page = 1;
  var num_documents = 0;

  // define the params to send to the stackexchange API
  var default_params = { 
    q: product_name, 
    site: 'stackoverflow', 
    pagesize: 25, 
    sort: 'relevance'
  };
  var params = Object.assign({}, default_params, options);

  let bulkWrite = [];      
  while (has_more === true) {
    // update the page before each search
    params.page = page;
    var data = await stackoverflow.search(product_name, params);

    // define the bulk write operations
    // and do some basic clean up of the data
    for (var i in data.items) {
      let document = data.items[i];
      let id = document.question_id;
      document.id = id;
      document.search_term = product_name;

      // write the document.  If it already exists, perform an update.  If it's new, then insert (upsert=true)
      bulkWrite.push(
        { updateOne: {
          filter: { id: id, search_term: product_name }, 
          update: data.items[i], 
          w: 1,
          upsert: true
        } }
      );
    }

    if (bulkWrite.length > 1000) {
      num_documents += bulkWrite.length;
      bulkWrite = await bulkWriteDocuments(collection, bulkWrite);
    }
    has_more = data.has_more;
    page++;
  }

  // clear out the last set of documents to write
  if (bulkWrite.length > 0) {
    num_documents += bulkWrite.length;
    bulkWrite = await bulkWriteDocuments(collection, bulkWrite);
  }

  return num_documents;
}

database.get().then(async(mongo) => {
  var promise_list = [];

  var start = (new Date('2017-01-01')).getTime()/1000;
  var options = {
    fromdate: start,
    pagesize: 100
  };

  var products_to_scrape = ['wepay', 'stripe', 'paypal', 'braintree', 'adyen', 'amazon payments', 'authorize.net', 'airtable'];
  
  var p = await Promise.map(products_to_scrape, async (product) => {
    var r = await scrape_product(mongo, product, options);
    return r;
  }, { concurrency: 8 });
  return p;
})
.then((r) => {
  console.log('DONE: ', r);
  process.exit(1);
})
.catch((err) => {
  console.log('ERROR FETCHING: ', err); 
  return;
});