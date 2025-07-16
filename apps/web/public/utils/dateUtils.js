window.NY_TZ = -4;
window.LON_TZ = 1;

window.nyNow = function(){
  const d = new Date();
  return new Date(d.getTime() + (window.NY_TZ - d.getTimezoneOffset()/60)*3600000);
};
window.lonNow = function(){
  const d=new Date();
  return new Date(d.getTime() + (window.LON_TZ - d.getTimezoneOffset()/60)*3600000);
};