export const roundMoney=(value:number)=>Math.round(value*100)/100;
export function treasuryHierarchy(realCash:number,committed:number,provisioned:number,futureIncome=0){
  const freeCash=roundMoney(realCash-committed-provisioned);
  const surplus=Math.max(freeCash+futureIncome,0);
  const recommendedSavings=roundMoney(surplus*0.4);
  return {realCash:roundMoney(realCash),committed:roundMoney(committed),provisioned:roundMoney(provisioned),futureIncome:roundMoney(futureIncome),freeCash,recommendedSavings,safeToSpend:roundMoney(freeCash-recommendedSavings)};
}
export function envelopeProgress(target:number,spent:number,elapsedRatio=1){
  const remaining=Math.max(target-spent,0); const projection=elapsedRatio>0?spent/elapsedRatio:spent;
  return {remaining:roundMoney(remaining),percent:target?Math.min(roundMoney(spent/target*100),999):0,projection:roundMoney(projection)};
}
