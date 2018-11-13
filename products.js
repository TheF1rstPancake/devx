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
    asana: {},
    smartsheet: {
      github: {
        query: 'smartsheet'
      }
    },
    wrike: {},
    'monday.com': {
      github: {
        query: 'dapulse'
      },
      stackoverflow: {
        query: 'dapulse'
      }
    },
    trello: {},
    quickbase: {},
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