require("dotenv").config();
const express = require("express");
const app = express();
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use("/public", express.static("public")); // 미들웨어
const methodOverride = require("method-override");
app.use(methodOverride("_method"));
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const saltRounds = 10;

app.use(
  session({
    secret: "비밀코드",
    store: MongoStore.create({
      mongoUrl: process.env.DB_URL,
    }),
    cookie: { maxAge: 3.6e6 * 24 }, // 24시간 유효
    resave: false, // connect-mongo 사용시 false
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

var db;
const MongoClient = require("mongodb").MongoClient;
MongoClient.connect(
  process.env.DB_URL,
  { useUnifiedTopology: true, useNewUrlParsar: true }, // warnning 메시지 줄여줌
  (err, client) => {
    if (err) return console.log(err);
    db = client.db("todoapp");

    // db.collection("post").insertOne(
    //   { title: "빨래하기", date: "2월 2일" },
    //   (err, res) => {
    //     console.log("저장완료");
    //   }
    // );
    app.listen(process.env.PORT, function () {
      console.log("listening on 8080...");
    });
  }
);

app.get("/", (req, res) => {
  res.render(__dirname + "/views/index.ejs");
});
app.get("/write", isLogin, (req, res) => {
  res.render(__dirname + "/views/write.ejs");
});
app.post("/add", isLogin, (req, res) => {
  // res.send("전송완료"); // 이 부분은 항상 존재해야함! 안그럼 브라우저가 멈춤
  // 메시지 말고 응답코드나 리다이렉트를 해주는 코드도 있음
  console.log(req.body);
  db.collection("counter").findOne(
    { name: "total-post-count" },
    (err, result) => {
      // console.log(result.totalPost);
      db.collection("post").insertOne(
        {
          _id: result.totalPost + 1,
          writer: req.user._id,
          title: req.body.title,
          date: req.body.date,
        },
        (err, result) => {
          if (err) console.log(err);
          console.log("저장완료");
          db.collection("counter").updateOne(
            { name: "total-post-count" },
            { $inc: { totalPost: 1 } },
            (err, result) => {
              if (err) console.log(err);
              res.redirect("/list");
            }
          );
        }
      );
    }
  );
});

app.get("/list", isLogin, (req, res) => {
  db.collection("post")
    .find()
    .toArray((err, result) => {
      if (err) console.log(err);
      // console.log(result);
      res.render(__dirname + "/views/list.ejs", { posts: result }); //__dirname이 빠져서 잘 안되었던 것,,
    });
});

app.get("/edit/:id", isLogin, (req, res) => {
  db.collection("post").findOne(
    { _id: parseInt(req.params.id) },
    (err, result) => {
      if (err) console.log(err);
      res.render(__dirname + "/views/edit.ejs", { post: result });
    }
  );
});

app.delete("/delete/:id", isLogin, (req, res) => {
  db.collection("post").deleteOne(
    { _id: parseInt(req.params.id), writer: req.user._id },
    (err, result) => {
      if (err) console.log(err);
      console.log("삭제완료");
      res.status(200).send({ message: "삭제 성공" });
    }
  );
});

app.get("/detail/:id", isLogin, (req, res) => {
  db.collection("post").findOne(
    { _id: parseInt(req.params.id) },
    (err, result) => {
      if (err) console.log(err);
      res.render(__dirname + "/views/detail.ejs", { data: result });
    }
  );
});

app.put("/edit", isLogin, (req, res) => {
  console.log(req.body);
  db.collection("post").updateOne(
    { _id: parseInt(req.body.id), writer: req.user._id },
    { $set: { title: req.body.title, date: req.body.date } },
    (err, result) => {
      if (err) console.log(err);
      res.redirect("/list");
    }
  );
});

app.get("/register", (req, res) => {
  res.render(__dirname + "/views/register.ejs");
});

app.post("/register", (req, res) => {
  // console.log(req.body); // { id: '', pw: '', pwChecker: '' }
  db.collection("login").findOne({ id: req.body.id }, (err, result) => {
    if (result) {
      res.send("이미 존재하는 아이디입니다.");
    } else if (req.body.pw !== req.body.pwChecker) {
      res.send("비밀번호가 일치하지 않습니다.");
    } else {
      bcrypt.hash(req.body.pw, saltRounds, (err, encryptedPW) => {
        if (err) return console.log(err);
        db.collection("login").insertOne(
          { id: req.body.id, nickname: req.body.nickname, pw: encryptedPW },
          (err) => {
            if (err) console.log(err);
            else res.redirect("/login");
          }
        );
      });
    }
  });
});

app.get("/logout", (req, res) => {
  if (req.user) {
    req.logout((err) => {
      if (err) console.log(err);
      req.session.destroy((err) => {
        // 세션 파괴
        if (err) console.log(err);
        res.clearCookie("connect.sid"); //쿠키 삭제
        res.redirect("/"); //홈으로 redirect
      });
    });
  } else res.send("로그인 하지 않았습니다");
});

app.get("/login", (req, res) => {
  res.render(__dirname + "/views/login.ejs");
});

app.post(
  "/login",
  passport.authenticate("local", { failureRedirect: "/fail" }),
  (req, res) => {
    // console.log(req.user);
    res.redirect("/");
  }
);

app.get("/mypage", isLogin, function (req, res) {
  console.log(req.user);
  res.render("mypage.ejs", { user: req.user });
});

function isLogin(req, res, next) {
  if (req.user) next();
  else {
    res.send(
      "<script>alert('로그인이 필요합니다.');location.href='/login';</script>"
    );
  }
}

passport.use(
  new LocalStrategy(
    {
      usernameField: "id",
      passwordField: "pw",
      session: false,
      passReqToCallback: false,
    },
    function (입력한아이디, 입력한비번, done) {
      //console.log(입력한아이디, 입력한비번);
      db.collection("login").findOne(
        { id: 입력한아이디 },
        function (err, result) {
          if (err) return done(err);

          if (!result)
            return done(null, false, { message: "존재하지않는 아이디입니다." });
          bcrypt.compare(입력한비번, result.pw, (err, isMatch) => {
            if (isMatch) {
              return done(null, result);
            } else {
              return done(null, false, {
                message: "아이디/비밀번호를 확인해주세요",
              });
            }
          });
        }
      );
    }
  )
);
passport.serializeUser(function (user, done) {
  done(null, user.id);
});
passport.deserializeUser(function (_id, done) {
  db.collection("login").findOne({ id: _id }, (err, result) => {
    done(null, result);
  });
});

app.get("/search", isLogin, (req, res) => {
  //console.log(req.query); // {value: "~~"}
  const attrs = [
    {
      $search: {
        index: "titleSearch",
        text: {
          query: req.query.value,
          path: "title", // 제목날짜 둘다 찾고 싶으면 ['제목', '날짜']
        },
      },
    },
    { $sort: { _id: 1 } },
    // { $limit: 10 },
    { $project: { title: 1, date: 1, _id: 0 } },
  ];
  db.collection("post")
    .aggregate(attrs)
    .toArray((err, result) => {
      if (err) return console.log(err);
      res.render(__dirname + "/views/search.ejs", {
        posts: result,
        query: req.query.value,
      });
    });
});
