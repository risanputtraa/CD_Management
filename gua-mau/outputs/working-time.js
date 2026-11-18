// Office hours in Asia/Jakarta (UTC+7), excluding weekends and calendar holidays.
function workingSecondsBetween(start,end,holidays=[]){
 const from=Date.parse(start||''),to=Date.parse(end||'');if(!Number.isFinite(from)||!Number.isFinite(to))return 0;if(to<from)throw Error('Finish time must be on or after start time');
 const shift=7*3600000,dayMs=86400000,excluded=new Set(holidays.map(h=>typeof h==='string'?h:h.holiday_date));let total=0;
 for(let day=Math.floor((from+shift)/dayMs)*dayMs;day<=Math.floor((to+shift)/dayMs)*dayMs;day+=dayMs){const date=new Date(day),weekday=date.getUTCDay();if(weekday===0||weekday===6||excluded.has(date.toISOString().slice(0,10)))continue;for(const [begin,finish] of [[9,12],[13,17]])total+=Math.max(0,Math.min(to,day+finish*3600000-shift)-Math.max(from,day+begin*3600000-shift));}
 return Math.floor(total/1000);
}
module.exports={workingSecondsBetween};
