const {connect}=require('./database');
const {createApp}=require('./app');
async function start(){
  try {
    const stores=await connect();
    const app=createApp({...stores,allowedOrigins:process.env.ALLOWED_ORIGINS,secureCookies:process.env.NODE_ENV==='production'});
    const port=Number(process.env.PORT)||3001;
    app.listen(port,()=>console.log(`Account server listening on ${port}`));
  } catch(error) {console.error(`Account server could not start: ${error.message}`);process.exitCode=1;}
}
if(require.main===module)start();
module.exports={start};
