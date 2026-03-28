const express = require('express');
const { WebcastPushConnection } = require('tiktok-live-connector');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const GIFT_POINTS = {'Rose':1,'TikTok':1,'Finger Heart':5,'Sunglasses':5,'Ice Cream':10,'Perfume':20,'Hand Heart':25,'Mic':50,'Concert':100,'Lion':500,'Universe':1000};

const COUNTRY_KEYS = {0:['sa','saudi','ksa'],1:['eg','egypt'],2:['pk','pakistan','pak'],3:['ae','uae','dubai'],4:['kw','kuwait'],5:['qa','qatar'],6:['bh','bahrain'],7:['om','oman'],8:['dz','algeria'],9:['ma','morocco']};

function detectCountry(uid,nick){const str=(uid+' '+nick).toLowerCase();for(const[i,keys]of Object.entries(COUNTRY_KEYS)){if(keys.some(k=>str.includes(k)))return parseInt(i);}return Math.floor(Math.random()*10);}
function getPoints(name,diamonds){return GIFT_POINTS[name]||Math.max(1,Math.floor((diamonds||1)/10));}

let connection=null;

app.post('/connect',async(req,res)=>{
const{username}=req.body;
if(!username)return res.json({success:false,error:'Username required'});
if(connection){try{connection.disconnect();}catch(e){}connection=null;}
try{
const uname=username.replace('@','').trim();
connection=new WebcastPushConnection(uname,{processInitialData:false,enableExtendedGiftInfo:true,enableWebsocketUpgrade:true,requestPollingIntervalMs:2000});
connection.on('connected',()=>{io.emit('status',{connected:true,username:uname});});
connection.on('disconnected',()=>{io.emit('status',{connected:false});});
connection.on('error',(err)=>{io.emit('status',{connected:false,error:err.message});});
connection.on('gift',(data)=>{
if(data.giftType===1&&!data.repeatEnd)return;
const country=detectCountry(data.uniqueId,data.nickname||'');
const repeat=data.repeatCount||1;
const pts=getPoints(data.giftName,data.diamondCount)*repeat;
io.emit('gift',{viewer:data.nickname||data.uniqueId,giftName:data.giftName||'Gift',country,points:pts,repeat});
});
connection.on('like',(data)=>{if((data.likeCount||0)<10)return;io.emit('like',{viewer:data.nickname,country:detectCountry(data.uniqueId,data.nickname||''),points:Math.floor(data.likeCount/10)});});
await connection.connect();
res.json({success:true});
}catch(err){res.json({success:false,error:'Make sure you are LIVE on TikTok!'});}
});

app.post('/disconnect',(req,res)=>{if(connection){try{connection.disconnect();}catch(e){}connection=null;}io.emit('status',{connected:false});res.json({success:true});});
app.get('/health',(req,res)=>res.json({status:'ok'}));

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`Running
