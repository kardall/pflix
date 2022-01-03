const fs = require("fs");
const path = require('path');
const cfg = require('./config.json');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
const express = require("express");
const cors = require('cors');
const app = express();
const glob = require("glob-promise");
const { MovieDb } = require('moviedb-promise')
const moviedb = new MovieDb(cfg.api_key)
const basicAuth = require('express-basic-auth')

app.use(express.static(__dirname))
app.use(cors())
app.use(express.json())

var authOptions = {
  users: cfg.users,
  challenge: true
}

app.use(basicAuth(authOptions))
app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

app.get("/manager", function(req,res) {
  res.sendFile(__dirname + "/librarymanager.html");
})

function sortResults(db, prop, asc) {
  return db.sort(function(a,b) {
    if(asc) {
      return (a[prop] > b[prop]) ? 1 : ((a[prop] < b[prop]) ? -1 : 0);
    } else {
      return (b[prop] > a[prop]) ? 1 : ((b[prop] < a[prop]) ? -1 : 0);
    }
  })
}

function HighestID(db) {
  if(db.length == 0) return 0
  id = 0
  for(var key in db) {
    if(db[key].id > id) {
      id = db[key].id
    }
  }
  return id
}

function VideoExists(db, fPath) {
  for(var key in db) {
    if(db[key].path == fPath) return true
  }
  return false
}

app.get("/manager/medialist", (req,res) => {
  var db = JSON.parse(fs.readFileSync(__dirname + "/videos.json"))
  db = sortResults(db,"title",true)
  res.send(JSON.stringify(db))
})

function getCategoryNameById(cat_id) {
  for(var cid in cfg.categories) {
    if(cfg.categories[cid].category == cat_id) {
      return cfg.categories[cid].name
    }
  }
}

app.get("/manager/getmovies", async (req,res) => {
  var db = JSON.parse(fs.readFileSync(__dirname + "/videos.json"),{ encoding: 'utf-8'})
  // Get Root for MOVIES
  var root_dir = ""
  for(var i=0;i<cfg.folders.length;i++) {
    if(cfg.folders[i].category == 0) {
      root_dir = cfg.folders[i].root
    }
  }

  var movies = []
  for(var i=0;i<db.length;i++) {
    if(db[i].path.indexOf(root_dir) == -1) continue;
    movies.push(db[i])
  }

  res.send(JSON.stringify(movies))

})
app.get("/manager/gettv", async (req,res) => {
  var db = JSON.parse(fs.readFileSync(__dirname + "/videos.json"),{ encoding: 'utf-8'})
  // Get Root for TV
  var root_dir = ""
  for(var i=0;i<cfg.folders.length;i++) {
    if(cfg.folders[i].category == 1) {
      root_dir = cfg.folders[i].root
    }
  }

  var tv = []
  for(var i=0;i<db.length;i++) {
    if(db[i].path.indexOf(root_dir) == -1) continue;
    tv.push(db[i])
  }
  tv = sortResults(tv, "season",true)
  var tmp = {}
  for(var idx=0;idx<tv.length;idx++) {
    var tvshow = tv[idx]
    if(!tmp.hasOwnProperty(tvshow.series)) {
      // Series Does Not Exist
      tmp[tvshow.series] = {
        [tvshow.season]:[
          tvshow
        ]
      }
    } else if(!tmp[tvshow.series].hasOwnProperty(tvshow.season)) {
      // Season Does Not Exist
      tmp[tvshow.series][tvshow.season] = [tvshow]
    } else if(!VideoExists(tmp[tvshow.series][tvshow.season], tvshow.path)) {
      // Show Does Not Exist
      tmp[tvshow.series][tvshow.season].push(tvshow)
    }
  } 
  
  // SORT ALL THE THINGS
  Object.keys(tmp).forEach(series => {
    Object.keys(tmp[series]).forEach(season => {
      tmp[series][season] = sortResults(tmp[series][season], "title", true)
    })
  })
  res.send(JSON.stringify(tmp))
})

app.get("/manager/scan", async (req,res) => {
  
  var db = JSON.parse(fs.readFileSync(__dirname + "/videos.json"))
  var id = HighestID(db)

  for(var i=0;i<cfg.folders.length;i++) {
    var cat = getCategoryNameById(cfg.folders[i].category)
    if(cat == "Movies") {
      await glob.promise(cfg.folders[i].root + "/**/*.mp4")
      .then(files => {
        for(var i=0; i<files.length;i++) {
          if(!VideoExists(db,files[i])) {
            db.push({
              "id":id,
              "path":files[i],
              "category":cat,
              "poster":"/no-poster-available.jpg"
            })
            id++;
          }
        }
      })
    } else if(cat == "TV") {
      //Need to catalog all directories as if they are the /Show Name/Season Number/Episode
      await glob.promise(cfg.folders[i].root + "/**/*.mp4")
      .then(files => {
        for(var i=0;i<files.length;i++) {
          var exists = false
          for(var j=0;j<db.length;j++) {
            if(db[j].path == files[i]) {
              exists = true
              continue
            }
          }
          if(!exists) {
            var path_structure = files[i].split('/')
            var fLen = path_structure.length
            var season = path_structure[fLen-2]
            var show = path_structure[fLen-3]
            
            db.push({
              "id":id,
              "path":files[i],
              "category":cat,
              "series":show,
              "season":season,
              "poster":"/no-poster-available.jpg"
            })
            id++;
          }
          
        }

      })
    }
   
  }
  for(var i=0;i<db.length;i++) {
    var title = db[i].title
    if(title == undefined) {
      var title = path.parse(db[i].path).base
      title = title.substring(0, title.indexOf(".mp4"))
      title = title.replace(/\(.*\)/g,"")
      db[i].title = title
    }
  }
  db = sortResults(db, "title", true)
  fs.writeFileSync(__dirname + "/videos.json", JSON.stringify(db))

  res.status(200).send("Scan Completed.")
})

app.post("/manager/poster", (req,res) => {
  var id = req.body.id
  var json = JSON.parse(fs.readFileSync(__dirname + "/videos.json"))
  for(var vid in json) {
    if(json[vid].id == id) {
      var title = json[vid].title
      var searchTerm = title
      if(req.body.custom) {
        searchTerm = req.body.custom
      }
      searchTerm = searchTerm.replace(/[\W_]+/g, " ")
      const findMovie = async(searchTerm) => {
        const res = await moviedb.searchMulti({query: searchTerm})
        return res
      }
      
      try {
        findMovie(searchTerm).then(results => res.send(results["results"])).catch(console.error)
      } catch (e) { console.log(e) }
    }
  }
  
})
app.post("/manager/poster/series", function (req,res) {
  var id = req.body.id
  var json = JSON.parse(fs.readFileSync(__dirname + "/videos.json"))
  for(var vid in json) {
    if(json[vid].id == id) {
      var title = json[vid].title
      var season_name = json[vid].season 
      var season_num = season_name.substr(season_name.indexOf(" ")+1)
      var searchTerm = title
      if(req.body.custom) {
        searchTerm = req.body.custom
      }
      searchTerm = searchTerm.replace(/[\W_]+/g, " ")
      const findMovie = async(searchTerm) => {
        const res = await moviedb.searchTv({query: searchTerm})
        return res
      }
      
      try {
        findMovie(searchTerm)
        .then(results => {
          res.send(results["results"])
        })
        .catch(console.error)
      } catch (e) { console.log(e) }
    }
  }
})
app.post("/manager/update", function (req,res) {
  var id = req.body.id
  var title = req.body.title
  var poster = req.body.poster
  var background = req.body.background
  var isSeries = req.body.isSeries
  var db = JSON.parse(fs.readFileSync(__dirname + "/videos.json"))

  if(isSeries) {
    // First find the id so we can get the Series Name
    var series_name = ''

    for(var vid in db) {
      if(db[vid].category == "TV") {
        if(db[vid].id == id) {
          series_name = db[vid].series
        }
      }
    }
    // Now, we set every single match with "Series" with the poster but keep name
    for(var vid in db) {
      if(db[vid].category == "TV") {
        if(db[vid].series == series_name) {
          db[vid].poster = poster
          db[vid].background = background
        }
      }
    }

  } else {
    for(var vid in db) {
      if(db[vid].id == id) {
        db[vid].title = title
        db[vid].poster = poster
        db[vid].background = background
      }
    }
  }

  db = sortResults(db, "title", true)
  fs.writeFileSync(__dirname + "/videos.json", JSON.stringify(db))
  res.send("ok");
})

app.get("/media/:id", function (req, res) {
  // Ensure there is a range given for the video
  const id = req.params.id;
  var json = JSON.parse(fs.readFileSync(__dirname + "/videos.json"))
  var file = ""

  for(var vid in json) {
    if(json[vid].id == id) {
      file = json[vid].path
    }
  }

  file = file.replace(/\//g,"\\")
  fs.stat(file, function(err, stats) {
    var range = req.headers.range
    if (!range) { // 416 Wrong range
        return res.sendStatus(416)
    }
    var positions = range.replace(/bytes=/, "").split("-");
    var start = parseInt(positions[0], 10);
    var total = stats.size;
    var end = positions[1] ? parseInt(positions[1], 10) : total - 1;
    var chunksize = (end - start) + 1;
    
    if(file.substr(file.length-4) == ".avi") {
      // AVI Files Transcode
      var stream = fs.createReadStream(file, { start: start, end: end, autoclose: true });
      var proc = new ffmpeg(stream)
      .outputOptions(['-movflags isml+frag_keyframe'])
      .toFormat('mp4')
      .withAudioCodec('copy')
      //.seekInput(offset) this is a problem with piping

      .on('error', function(err,stdout,stderr) {
          // console.log('an error happened: ' + err.message);
          // console.log('ffmpeg stdout: ' + stdout);
          // console.log('ffmpeg stderr: ' + stderr);
      })
      .on('end', function() {
          // console.log('Processing finished !');
      })
      .on('progress', function(progress) {
          // console.log('Processing: ' + progress.percent + '% done');
      })
      .pipe(res, {end: true});
    } else {
      const videoSize = fs.statSync(file).size;
      // Create headers
      const contentLength = end - start + 1;
      const headers = {
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": contentLength,
        "Content-Type": "video/mp4",
      };

      // HTTP Status 206 for Partial Content
      res.writeHead(206, headers);

      // create video read stream for this particular chunk
      const videoStream = fs.createReadStream(file, { start, end });

      // Stream the video chunk to the client
      videoStream.pipe(res);
    }
    
  });
});

app.listen(cfg.port, function () {
  console.log("Listening on port "+cfg.port+"!");
});