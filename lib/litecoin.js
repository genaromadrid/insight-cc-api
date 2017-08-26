 


var litecore=require('litecore-lib');

  

var extra={
    network:litecore.Networks.testnet
}
 
// <Address Generadas>
// "QejU7vsSd2GMjUFajtfY3MgmgWfUaqSXE1" -> fondeada,
// "QUz2iVLN5vmBvpK5SnP6aqwcyJp2mqW9Gx"
// {"txid":"aa4ee80dfacc74d3467c53ff3e4402437bf213ef3831bfd7452e7350e1f5386c"} -> mrdwvWkma2D6n9mGsbtkazedQQuoksnqJV
// {"txid":"58287242f0051334cf7abcf52576baaa3e44d05b510b01621cdf564ef0a111e2"} -> QUz2iVLN5vmBvpK5SnP6aqwcyJp2mqW9Gx


var privateKeysFrom = [
  new litecore.PrivateKey('cNxY6LPFn7MNoxLozF1P3boCpcTTJ1P7mmKaTx8fdLPdmTMd82UW'),
  new litecore.PrivateKey('cQvfDc34hJbUA4st7aYuuM15p5KEYcXkAMvSowugNUhoj7x4gjfw'),
 ];

var privateKeysTo = [
  new litecore.PrivateKey('cRXrTHxuLVX2zHsdWQaE462s9zzjBVADAGAuNnYvAZDcQWBakFKq') ,
  new litecore.PrivateKey('cQdt4agXGGhqq6jTnKgRZy5XwWW7teAhuKfkgpQmofyDpYb8dQg5') 
]

var publicKeysFrom = privateKeysFrom.map(litecore.PublicKey); 
var address_from = new litecore.Address(publicKeysFrom, 2,litecore.Networks.testnet);
console.log(address_from)


var publicKeysTo = privateKeysTo.map(litecore.PublicKey); 
var address_to= new litecore.Address(publicKeysTo, 2,litecore.Networks.testnet);
console.log(address_to)


 
 
var utxo = {
  "txId" : "7197dc9af0b40d66f394c12400437b439b6c93592ad7e09faae6734227ec766e",
  "outputIndex" : 1,
  "address" : address_from.toString(),
  "script" : new litecore.Script(address_from).toHex(),
  "satoshis" : 100000000
};
 
var multiSigTx = new litecore.Transaction()
    .from(utxo, publicKeysFrom, 2)
    .to(address_to, 90000000)
    .change(address_from.toString()) 
    .sign(privateKeysFrom);
  
console.log(multiSigTx)
console.log(multiSigTx.getFee())
