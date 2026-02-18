const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// pliki JSON
const postsFile = path.join(__dirname,'posts.json');
const bannedFile = path.join(__dirname,'banned.json');

// funkcje pomocnicze
function getPosts(){ return fs.existsSync(postsFile)? JSON.parse(fs.readFileSync(postsFile)) : []; }
function savePosts(posts){ fs.writeFileSync(postsFile, JSON.stringify(posts,null,2)); }

function getBanned(){ 
  if(!fs.existsSync(bannedFile)){
    // domyślne slury
    const slurs = ["fag","faggot","nigger","nigga","chink","spic","kike","retard","tranny","dyke","gook","slut","whore","bitch","cunt"];
    fs.writeFileSync(bannedFile,JSON.stringify(slurs,null,2));
  }
  return JSON.parse(fs.readFileSync(bannedFile));
}
function saveBanned(list){ fs.writeFileSync(bannedFile,JSON.stringify(list,null,2)); }

// GET /api/posts
app.get('/api/posts',(req,res)=>{ res.json(getPosts()); });

// POST /api/posts
app.post('/api/posts',(req,res)=>{
  const {group,text,img}=req.body;
  if(!group || (!text && !img)) return res.status(400).send('Invalid post');

  // automatyczna moderacja
  const banned = getBanned();
  if(text && banned.some(w => text.toLowerCase().includes(w))){
    return res.status(403).json({success:false,message:"Post contains prohibited language!"});
  }

  const posts = getPosts();
  posts.unshift({
    group,
    text,
    img,
    date:new Date().toLocaleString(),
    reactions:{"👍":0,"😂":0,"🔥":0,"❤️":0}
  });
  savePosts(posts);
  res.json({success:true});
});

// POST /api/react
app.post('/api/react',(req,res)=>{
  const {index,emoji} = req.body;
  const posts = getPosts();
  if(!posts[index]) return res.status(400).send('Invalid index');
  if(!posts[index].reactions[emoji]) posts[index].reactions[emoji]=0;
  posts[index].reactions[emoji]++;
  savePosts(posts);
  res.json({success:true});
});

// POST /api/delete
app.post('/api/delete',(req,res)=>{
  const {index}=req.body;
  const posts = getPosts();
  if(posts[index]){
    posts.splice(index,1);
    savePosts(posts);
    return res.json({success:true});
  }
  res.status(400).send('Invalid index');
});

// POST /api/bannedWords
app.post('/api/bannedWords',(req,res)=>{
  const {word}=req.body;
  if(!word) return res.status(400).send('No word provided');
  let banned = getBanned();
  if(!banned.includes(word)){
    banned.push(word);
    saveBanned(banned);
  }
  res.json({success:true});
});

// POST /api/removeBanned
app.post('/api/removeBanned',(req,res)=>{
  const {word}=req.body;
  let banned = getBanned();
  banned = banned.filter(w=>w!==word);
  saveBanned(banned);
  res.json({success:true});
});

// GET /api/bannedWords
app.get('/api/bannedWords',(req,res)=>{
  res.json(getBanned());
});

app.listen(PORT,()=>console.log(`Server running at http://localhost:${PORT}`));
