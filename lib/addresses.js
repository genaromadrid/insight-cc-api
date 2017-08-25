'use strict';

var bitcore = require('litecore-lib');
var async = require('async');
var TxController = require('./transactions');
var Common = require('./common');
var util = require('util');
var ERRORS = [
  "value undefined in pubKeys or reqSigs",
  "incorrect format pubKeys must be Array and reqSigs integer",
  "the amount the item in pubKeys must be less than equal to reqSigs",
  "verify any pubKeys is incorrect" 
]

function AddressController(node) {
  this.node = node;
  this.txController = new TxController(node);
  this.common = new Common({ log: this.node.log });
}

AddressController.prototype.show = function(req, res) {
  var self = this;
  var options = {
    noTxList: parseInt(req.query.noTxList),
  };

  if (req.query.from && req.query.to) {
    options.from = parseInt(req.query.from);
    options.to = parseInt(req.query.to);
  }

  this.getAddressSummary(req.addr, options, function(err, data) {
    if(err) {
      return self.common.handleErrors(err, res);
    }

    res.jsonp(data);
  });
};

AddressController.prototype.balance = function(req, res) {
  this.addressSummarySubQuery(req, res, 'balanceSat');
};

AddressController.prototype.totalReceived = function(req, res) {
  this.addressSummarySubQuery(req, res, 'totalReceivedSat');
};

AddressController.prototype.totalSent = function(req, res) {
  this.addressSummarySubQuery(req, res, 'totalSentSat');
};

AddressController.prototype.unconfirmedBalance = function(req, res) {
  this.addressSummarySubQuery(req, res, 'unconfirmedBalanceSat');
};

AddressController.prototype.addressSummarySubQuery = function(req, res, param) {
  var self = this;
  this.getAddressSummary(req.addr, {}, function(err, data) {
    if(err) {
      return self.common.handleErrors(err, res);
    }

    res.jsonp(data[param]);
  });
};

AddressController.prototype.getAddressSummary = function(address, options, callback) {

  this.node.getAddressSummary(address, options, function(err, summary) {
    if(err) {
      return callback(err);
    }

    var transformed = {
      addrStr: address,
      balance: summary.balance / 1e8,
      balanceSat: summary.balance,
      totalReceived: summary.totalReceived / 1e8,
      totalReceivedSat: summary.totalReceived,
      totalSent: summary.totalSpent / 1e8,
      totalSentSat: summary.totalSpent,
      unconfirmedBalance: summary.unconfirmedBalance / 1e8,
      unconfirmedBalanceSat: summary.unconfirmedBalance,
      unconfirmedTxApperances: summary.unconfirmedAppearances, // misspelling - ew
      txApperances: summary.appearances, // yuck
      transactions: summary.txids,
    };

    callback(null, transformed);
  });
};

AddressController.prototype.checkAddr = function(req, res, next) {
  req.addr = req.params.addr;
  this.check(req, res, next, [ req.addr ]);
};

AddressController.prototype.checkAddrs = function(req, res, next) {
  if(req.body.addrs) {
    req.addrs = req.body.addrs.split(',');
  } else {
    req.addrs = req.params.addrs.split(',');
  }

  this.check(req, res, next, req.addrs);
};

AddressController.prototype.check = function(req, res, next, addresses) {
  var self = this;
  if(!addresses.length || !addresses[0]) {
    return self.common.handleErrors({
      message: 'Must include address',
      code: 1,
    }, res);
  }

  for(var i = 0; i < addresses.length; i++) {
    try {
      var a = new bitcore.Address(addresses[i]);
    } catch(e) {
      return self.common.handleErrors({
        message: 'Invalid address: ' + e.message,
        code: 1,
      }, res);
    }
  }

  next();
};


AddressController.prototype.utxo = function(req, res) {
  var self = this;
  var transform=self.transformUtxo;
  self._utxo(req.addr,transform,function(err, utxos) {
    if(err) {
      return self.common.handleErrors(err, res);
    }
    res.jsonp(utxos);
  });
};

AddressController.prototype._utxo = function(address, transform, callback) {
  this.node.getAddressUnspentOutputs(address, {}, (err, utxos) => {
    if(err) {
      callback(err);
      this.node.log.error(err.message);
      return;
    } else if (!utxos.length) {
      return callback(null, []);
    }
    utxos = utxos.map(transform.bind(this));
    return callback(null,utxos);
  });
};

AddressController.prototype.multiutxo = function(req, res) {
  var self = this;
  this.node.getAddressUnspentOutputs(req.addrs, true, function(err, utxos) {
    if(err && err.code === -5) {
      return res.jsonp([]);
    } else if(err) {
      return self.common.handleErrors(err, res);
    }

    res.jsonp(utxos.map(self.transformUtxo.bind(self)));
  });
};

AddressController.prototype.transformUtxo = function(utxoArg) {
  var script = new bitcore.Script(utxoArg.script);
  var addressInfo = script.getAddressInfo();
  var utxo = {
    addresses: [ utxoArg.address ],
    txid: utxoArg.txid,
    index: utxoArg.outputIndex,
    scriptPubKey: {
      hex: utxoArg.script,
      asm: script.toASM(),
      type: addressInfo.type,
    },
    value: utxoArg.satoshis,
  };
  if (utxoArg.height && utxoArg.height > 0) {
    utxo.height = utxoArg.height;
    utxo.confirmations = this.node.services.bitcoind.height - utxoArg.height + 1;
  } else {
    utxo.confirmations = 0;
  }
  if (utxoArg.timestamp) {
    utxo.ts = utxoArg.timestamp;
  }
  return utxo;
};

AddressController.prototype.ccBuilderTransformUtxo = function(utxoArg) {
  const utxo = {
    txid: utxoArg.txid,
    index: utxoArg.outputIndex,
    value: utxoArg.satoshis,
    confirmations: 0,
    scriptPubKey: {
      hex: utxoArg.script,
      addresses: [ utxoArg.address ],
    },
  };

  if (utxoArg.height > 0) {
    utxo.height = utxoArg.height;
    utxo.confirmations = this.node.services.bitcoind.height - utxoArg.height + 1;
  }

  return utxo;
};



AddressController.prototype._getTransformOptions = function(req) {
  return {
    noAsm: parseInt(req.query.noAsm) ? true : false,
    noScriptSig: parseInt(req.query.noScriptSig) ? true : false,
    noSpent: parseInt(req.query.noSpent) ? true : false,
  };
};

AddressController.prototype.multitxs = function(req, res) {
  var self = this;

  var options = {
    from: parseInt(req.query.from) || parseInt(req.body.from) || 0,
  };

  options.to = parseInt(req.query.to) || parseInt(req.body.to) || parseInt(options.from) + 10;

  self.node.getAddressHistory(req.addrs, options, function(err, result) {
    if(err) {
      return self.common.handleErrors(err, res);
    }

    var transformOptions = self._getTransformOptions(req);

    self.transformAddressHistoryForMultiTxs(result.items, transformOptions, function(err, items) {
      if (err) {
        return self.common.handleErrors(err, res);
      }
      res.jsonp({
        totalItems: result.totalCount,
        from: options.from,
        to: Math.min(options.to, result.totalCount),
        items: items,
      });
    });

  });
};

AddressController.prototype.transformAddressHistoryForMultiTxs = function(txinfos, options, callback) {
  var self = this;

  var items = txinfos.map(function(txinfo) {
    return txinfo.tx;
  }).filter(function(value, index, self) {
    return self.indexOf(value) === index;
  });

  async.map(
    items,
    function(item, next) {
      self.txController.transformTransaction(item, options, next);
    },
    callback
  );
};

AddressController.prototype.createAddresses = function(req, res){
  let bulk = req.body;
  let self = this;
  this._processingBulk(bulk).then(function(multisignContainer){
    if (multisignContainer.multisign_not_valid.length > 0){
      let container={
        message:'Verify your information the following records are not valid',
        multisign_not_valid:multisignContainer.multisign_not_valid
      }
      res.status(400).send(container);
    }else{
      let addresses=multisignContainer.multisign_valid.map(function(multisign){ 
        let address = bitcore.Address(multisign.pub_keys,multisign.reqSigs,self.node.network);
        return address.toString();
      })
      res.status(200).send(addresses);
    } 
   }).catch(function(err){  
     return self.common.handleErrors(err, res);
   }); 
};

AddressController.prototype._processingBulk = function(bulk){ 
 let multisignContainer = {
    multisign_valid:[],
    multisign_not_valid: []
 };
 return new Promise((resolve,reject) => {
    bulk.forEach(function(item){ 
         let validUndefined = ((item.reqSigs !== undefined) && (item.pub_keys !== undefined));
         let validFormat = (Number.isInteger(item.reqSigs) && util.isArray(item.pub_keys));
         let isValid = (validUndefined && validFormat);
         isValid = isValid && ((item.reqSigs > 0) && (item.reqSigs <= item.pub_keys.length));
         if (isValid){
            let pub_keys = item.pub_keys.filter(function(pubKey){
                return bitcore.PublicKey.isValid(pubKey);
            });
            isValid = (item.pub_keys.length === pub_keys.length);
          } 
        if (isValid){
          multisignContainer.multisign_valid.push(item);
        }else{
          multisignContainer.multisign_not_valid.push(item);
        }
    });
    resolve(multisignContainer);
 }).catch(function(err){
   throw err;
 }); 
}


module.exports = AddressController;
