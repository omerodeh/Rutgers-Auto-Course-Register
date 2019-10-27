const puppeteer = require('puppeteer');
const $ = require('cheerio');
const colors = require('colors');

var http = require(‘http’).Server(app);
const io = require('socket.io');
var express = require('express')(http);
var bodyParser = require('body-parser');
var app     = express();

port = 8080;
app.get('/', (req, res) => res.send('Hello World!'))

app.listen(port, () => console.log(`Example app listening on port ${port}!`))


app.use(bodyParser.urlencoded());
app.use(express.static(__dirname + 'public'));
//app.use(bodyParser.urlencoded({ extended: true })); 

/*
1. Go to https://sis.rutgers.edu/soc/#home and search for your class.
2. Put that link in url variable
3. Input the rest of your information.
4. Run with node "app.js"
*/
var sectionNumbers = [];
var sectionIndexNumbers = [];
var NETID = '';
var PASSWORD = '';
const delayBetweenChecks = 2000; //milliseconds


app.get('/live', (req, res) => {
    //    res.sendfile(__dirname + '/public/live.html');
     
    res.send("<h1> HELLO BISHES </h1><textarea rows=\"4\" cols=\"50\" disabled=\"true\" readonly=\"true\" placeholder=\"Console log\"></textarea>");
    io.emit('message', req.body);
    res.sendStatus(200);
    start();
    res.end()
});

app.post('/submit', (req, res) => {
    sectionNumbers = req.body.sNums.split(",");
    sectionIndexNumbers = req.body.sIndexNums.split(",") ;
    NETID = req.body.netid;
    PASSWORD = req.body.password;
    console.log(req.body.sNums);
    console.log(sectionNumbers);
    //...
    //  res.end()
    res.redirect("/live");
    console.log("got back from live");
    res.end();
});

function ClassToRegister(url, sectionNumber, sectionIndexNumber, i) {
    this.url = url;
    this.sectionNumber = sectionNumber;
    this.sectionIndexNumber = sectionIndexNumber;
    this.i = i;
    this.html = null;
}

function generateURL(sectionIndexNumber) {
    console.log("GENERATING URL");
    return "https://sis.rutgers.edu/soc/#keyword?keyword=" + sectionIndexNumber + "&semester=92019&campus=NB&level=U";
}

function pre_start(){
    for (let j = 2; j < process.argv.length; j++) {
        console.log(j + ' -> ' + (process.argv[j]));
        let current = process.argv[j];
        if (j == 2){
            sectionNumbers = current.split(",");
        }
        if (j == 3){
            sectionIndexNumbers = current.split(",");
        }
        if (j == 4){
            NETID = current
        }
        if (j == 5){
            PASSWORD = current
        }
    }

}

function start() {
    io.sockets.emit('update-msg', { data: 'STARTED'});
    console.log(sectionIndexNumbers);
    if (sectionNumbers.length != sectionIndexNumbers.length) {
        console.log("incorrect inputs");
        return;
    }
    for (var i = 0; i < sectionNumbers.length; i++) {
        var classToRegister = new ClassToRegister(generateURL(sectionIndexNumbers[i]), sectionNumbers[i], sectionIndexNumbers[i], i);
        getScheduleInfo(classToRegister);
    }
}


//go to course schedule planner
function getScheduleInfo(course) {
    console.log("Getting Schedule Info");
    try {
        puppeteer.launch({
            headless: true
        }).then(async browser => {
            var schedulePage = await browser.newPage();

            do {
                try {

                    if (course.html == null) {
                        await schedulePage.goto(course.url, {
                            waitUntil: 'networkidle2'
                        });
                    } else {
                        await schedulePage.reload({
                            waitUntil: 'networkidle2'
                        });

                    }

                    course.html = await schedulePage.evaluate(() => document.body.outerHTML);

                } catch (e) {
                    console.log(e);
                }
                await sleep(delayBetweenChecks);
                var status = await checkAndRegister(course);
            } while (status == false);

            await browser.close();
        });
    } catch (e) {
        console.log(e);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function makeTimeoutFunc(param) {
    return function() {
        // does something with param
    }
}

function saveToFile(item) {
    const fs = require('fs');
    fs.writeFile("debug.html", item, function(err) {
        if (err) {
            return console.log(err);
        }
        console.log("The file was saved!");
    });
}

async function checkAndRegister(course) {


    var gotClass = false;
    if (course.html === null) {
        return gotClass;
    }

    //iterate through all open classes
    $('.sectionopen', course.html).each(function() {
        console.log($(this).text());
        if ($(this).text() == course.sectionNumber) {
            console.log(course.sectionIndexNumber + " is open. Attempting to register.  ".green);
            //go to webreg and attempt registeration
            try {
                puppeteer.launch({
                    headless: false
                }).then(async browser => {
                    var registerPage = await browser.newPage();

                    await registerPage.goto('https://sims.rutgers.edu/webreg/', {
                        waitUntil: 'networkidle2'
                    });
                    //this sequence starts at webreg landing page and ends at registration.
                    await registerPage.evaluate(() => {
                        document.querySelectorAll('a')[0].click();
                    }, {
                        waitUntil: 'networkidle2'
                    });

                    await registerPage.waitForNavigation();
                    await registerPage.focus('#username');
                    await registerPage.keyboard.type(NETID);
                    await registerPage.focus('#password');
                    await registerPage.keyboard.type(PASSWORD);
                    //console.log(0);
                    await registerPage.click('#fm1 > fieldset > div:nth-child(7) > input.btn-submit');

                    //choose semester
                    try {
                        await registerPage.waitForSelector('#wr > div');
                        await registerPage.click("#wr > div");
                    } catch (e) {
                        console.log("Failed to log in. netid/ password is incorrect.");
                    }

                    await registerPage.waitForSelector('#i1');
                    await registerPage.focus('#i1');
                    await registerPage.keyboard.type(course.sectionIndexNumber);
                    await registerPage.waitFor(300);
                    await registerPage.click('#submit');
                    await registerPage.waitFor(15000);


                    var text = null;
                    try{
                        text = await registerPage.evaluate(() => document.querySelector('.ok').textContent);
                        console.log(text);
                        gotClass=true;
                        process.exit(0);
                    }
                    catch(e){
                        console.log(await registerPage.evaluate(() => document.querySelector('.error').textContent));
                    }

                    await registerPage.close();
                    await browser.close();

                });
            } catch (error) {
                console.log(error);
            }
        }
    });

    if(!gotClass){
        console.log((NETID + " " + course.sectionIndexNumber + " not open. Retrying...   " + " ").red + new Date(Date.now()).toLocaleString());
    }
    return gotClass;
}
//pre_start();
//start();
