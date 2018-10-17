const axios = require('axios');
const database = require('./database');
const stackoverflow = require('./stackoverflow');

async function scrape_product(mongo, product_name, options) {
  options = options === undefined ? {} : options;
  // create the document for the product
  // we won't do anything with the document until the end of this function
  await database.create_product(mongo, 'wepay');
  
  // get the StackOverflow collection
  var collection = await mongo.collection('StackOverflow');

  // initialize variables
  var promise_list = [];
  var id_list = [];
  var has_more = true;
  var page = 1;

  // define the params to send to the stackexchange API
  var default_params = { 
    q: product_name, 
    site: 'stackoverflow', 
    pagesize: 25, 
    sort: 'relevance'
  };
  var params = Object.assign({}, default_params, options);

  while (has_more === true) {
    // update the page before each search
    params.page = page;
    var data = await stackoverflow.search(product_name, params);

    // define the bulk write operations
    // and do some basic clean up of the data
    let bulkWrite = [];      
    for (var i in data.items) {
      let id = data.items[i].question_id;
      data.items[i].id = id;
      id_list.push(id);
      bulkWrite.push(
        { updateOne: {
          filter: { id: id }, 
          update: data.items[i], 
          w: 1,
          upsert: true
        } }
      );
    }

    if (bulkWrite.length > 0) {
      // write the data to Mongo and set up the next search
      console.log(`Writing items to StackOverflow collection (page: ${ page }) `);
      var p = collection.bulkWrite(bulkWrite, { ordered: false });
      promise_list.push(p);
    }
    has_more = data.has_more;
    page++;
  }

  // now write the list of question IDs to the Product
  if (id_list.length > 0) {
    console.log(`Writing StackOverflow ids to Product ${ product_name }`);
    var products = await mongo.collection('Product');
    var p = products.updateOne(
      { name: product_name },  
      { $addToSet: { questions: { $each: id_list } } },
      { upsert: true }
    );
    promise_list.push(p);
  }
  var r = await Promise.all(promise_list);
  return r;
}

database.get().then(async(mongo) => {
  var promise_list = [];

  var start = (new Date('2017-01-01')).getTime()/1000;
  var options = {
    fromdate: start,
    pagesize: 100
  };

  var products_to_scrape = ['wepay', 'stripe', 'paypal', 'braintree', 'adyen', 'amazon payments', 'authorize.net'];

  for (var i in products_to_scrape) {
    promise_list.push(
      scrape_product(mongo, products_to_scrape[i], options)
    );
  }

  var r = await Promise.all(promise_list);
  return r;
})
.then((r) => {
  process.exit(1);
})
.catch((err) => {
  console.log('ERROR FETCHING: ', err); 
  return;
});