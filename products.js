module.exports = {
  products: {
    wepay: {
      github: {
        query: 'wepay payments topic:wepay'
      }
    },
    stripe: {},
    paypal: {},
    braintree: {},
    adyen: {},
    'amazon pay': {},
    'authorize.net': {
      github: {
        query: 'authorizenet'
      }
    },
    airtable: {},
    slack: {
      stackoverflow: {
        tagged: 'slack-api'
      }
    },
    twilio: {},
    zuora: {},
    shopify: {},
    square: {
      stackoverflow: {
        tagged: 'square'
      }
    }
  },
  sites: {
    stackoverflow: {
      fromdate: '2017-01-01',
      pagesize: 100
    },
    github: {
      fromdate: '2017-01-01',
      pagesize: 100
    }
  }
};