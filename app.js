const puppeteer = require('puppeteer');
const $ = require('cheerio');
const colors = require('colors');

/*
1. Go to https://sis.rutgers.edu/soc/#home and search for your class.
2. Put that link in url variable
3. Input the rest of your information.
4. Run with node "app.js"
*/
const url = ['https://sis.rutgers.edu/soc/#keyword?keyword=INTRODUCTION%20TO%20CREATIVE%20WRITING&semester=12019&campus=NB&level=U',
'https://sis.rutgers.edu/soc/#keyword?keyword=INTRODUCTION%20TO%20CREATIVE%20WRITING&semester=12019&campus=NB&level=U','https://sis.rutgers.edu/soc/#keyword?keyword=INTRODUCTION%20TO%20CREATIVE%20WRITING&semester=12019&campus=NB&level=U'];
const sectionNumber = [17,18,19];
const sectionIndexNumber = ['09452','09452','09452'];
const NETID = 'asef23r';
const PASSWORD = 'segjklf';
//const registered = false;

function ClassToRegister(url, sectionNumber,sectionIndexNumber,i) {
  this.url = url;
  this.sectionNumber=sectionNumber;
  this.sectionIndexNumber=sectionIndexNumber;
  this.registered=false;
  this.i=i;
}

function start(){
  for (var i = 0; i < url.length; i++) {
  var classToRegister=new ClassToRegister(url[i],sectionNumber[i],sectionIndexNumber[i],i);
  getScheduleInfo(classToRegister);
}
}


//go to course schedule planner
function getScheduleInfo(class1) {
  puppeteer.launch().then(async browser => {
    var schedulePage = await browser.newPage();
    await schedulePage.goto(class1.url, {
      waitUntil: 'networkidle2'
    });

    let bodyHTML = await schedulePage.evaluate(() => document.body.outerHTML);
    //saveToFile(bodyHTML);
    //above line is for debugging

    await checkAndRegister(bodyHTML,class1);
    await browser.close();
    if (class1.registered === false) {

      setTimeout(getScheduleInfo(class1), 100);
    }
  });
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

function checkAndRegister(html,class1) {
  var foundOpenClass = false;
  //iterate through all open classes
  $('.sectionopen', html).each(function() {
    if ($(this).text() == class1.sectionNumber) {
      console.log("Requested class is open. Attempting to register.".green);
      foundOpenClass = true;
      //go to webreg and attempt registeration
      puppeteer.launch({
        headless: true
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
        try{
        await registerPage.waitForNavigation();
        await registerPage.focus('#username');
        await registerPage.keyboard.type(NETID);
        await registerPage.focus('#password');
        await registerPage.keyboard.type(PASSWORD);
        await registerPage.click('#fm1 > fieldset > div:nth-child(7) > input.btn-submit');
        await registerPage.waitForNavigation();
        await registerPage.waitFor(300);
        await registerPage.click('#submit');
        await registerPage.waitForNavigation();
        await registerPage.focus('#i1');
        await registerPage.keyboard.type(class1.sectionIndexNumber);
        await registerPage.waitFor(300);
        await registerPage.click('#submit');
        await registerPage.waitFor(15000);
}
catch(error){
  console.log(error);
}
        try {
          var text = await registerPage.evaluate(() => document.querySelector('.ok').textContent);
          console.log(text);
          if (text === "1 course(s) added successfully.") {
            console.log("Successfully registered. Shutting down...".green);
            class1.registered = true;
          }

        } catch (error) {
          try {
            console.log(await registerPage.evaluate(() => document.querySelector('.error').textContent) + " Retrying...".purple);
          } catch (err) {
            console.log("Course registeration error occured. Retrying...".red);
          }
          console.log("Course registeration error occured. Retrying...".red);
        }
        await browser.close();
      });
    }
  });
  if (foundOpenClass == false) {
    console.log("Class not open. Retrying...   ".red+class1.i);
  }
}
start();
//getScheduleInfo();
