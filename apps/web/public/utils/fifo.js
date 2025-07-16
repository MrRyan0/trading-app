export function buildFIFO(trades){
  const map = {};
  trades.forEach(t=>{
    const {symbol, type, qty, price, date} = t;
    if(!map[symbol]) map[symbol] = {long:[], short:[]};
    const s = map[symbol];
    const q = Math.abs(qty);
    if(type==='BUY'){
      s.long.push({qty:q, price});
    }else if(type==='SELL'){
      consume(s.long, q);
    }else if(type==='SHORT'){
      s.short.push({qty:q, price});
    }else if(type==='COVER'){
      consume(s.short, q);
    }
  });
  return map;
}
function consume(stack, qty){
  let remain = qty;
  while(remain>0 && stack.length){
    const batch = stack[0];
    if(batch.qty<=remain){ remain -= batch.qty; stack.shift(); }
    else{ batch.qty -= remain; remain = 0; }
  }
}
export function getOpenPositions(fifoMap){
  const pos = [];
  for(const sym in fifoMap){
    fifoMap[sym].long.forEach(b=>pos.push({symbol:sym, qty:b.qty, cost:b.price, dir:'LONG'}));
    fifoMap[sym].short.forEach(b=>pos.push({symbol:sym, qty:b.qty, cost:b.price, dir:'SHORT'}));
  }
  return pos;
}