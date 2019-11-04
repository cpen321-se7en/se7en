const express = require("express");
const mongocli = require("mongodb").MongoClient;

const app = express();
app.use(express.json());

var userDb;
var scheduleDb;

var doesntExist = function(obj) {
    return Object.keys(obj).length === 0;
};

var isAcceptablePreferences = function(a,b,c) {
    return a + b + c === 12;
};

/*
* Connect to the mongodb database
*/

mongocli.connect("mongodb://localhost:27017", {useNewUrlParser: true, useUnifiedTopology: true}, (err, client) => {
  if (err) {return err;}

  userDb = client.db("userDb");
  scheduleDb = client.db("scheduleDb");

  /* User Database */
  userDb.createCollection("infoClt", function(err, res) {
    if (err) {throw err;}
    // console.log("Info collection created!");
  });
  userDb.createCollection("preferencesClt", function(err, res) {
    if (err) {throw err;}
    // console.log("Peferences collection created!");
  });
  userDb.createCollection("matchesClt", function(err, res) {
    if (err) {throw err;}
  });

  /* Schedule Database */
  scheduleDb.createCollection("scheduleClt", function(err, res) {
    if (err) {throw err;}
    // console.log("Schedule collection created!");
  });

  app.listen(3000, function() {
    //   console.log("server is up!");
  })
})

/*______________________________________________________________________________________
 * Helper funtions used for the match algorithm
 *______________________________________________________________________________________*/


/* A helper function used for sorting algorithm */
function generateMatch(kindness, hardWorking, patience, array){

    // Create one dimensional array
    var score = new Array(array.length);

    // Loop to create 2D array using 1D array
    for (var i = 0; i < score.length; i++) {
        score[i] = new Array(2);
    }
    for(var i = 0; i < array.length; i++){
        score[i][0] =   Math.abs(kindness - array[i].kindness) +
                        Math.abs(hardWorking - array[i].hardWorking) +
                        Math.abs(patience - array[i].patience);
        score[i][1] =   array[i].userId;
    }
    /* Do insertion sort */
    for(var i = 0; i < array.length; i++){
        var sc = score[i][0]; //score
        var id = score[i][1]; //userId
        var j = i;
        while(j>0 && score[j-1][0] > sc){
            score[j][0] = score[j-1][0];
            score[j][1] = score[j-1][1];
            j--;
        }
        score[j][0] = sc;
        score[j][1] = id;
    }
    var ret = [];
    for(var i = 0; i < array.length; i++){
       ret[i] = score[i][1];
    }

    return ret;
}
/* A helper function that filters the array by the time, date */
function timeFilterMatch(inforArray, scheduleArray, userId){
    var filteredMatches = [];
    for(var i = 0; i < inforArray.length; i++){
        var infor = parseInt(inforArray[i].userId, 10);
        for(var j = 0; j < scheduleArray.length; j++){
            if(infor == parseInt(scheduleArray[j].userId, 10) && infor != userId){
                filteredMatches.push(inforArray[i]);
            }
        }
    }
    return filteredMatches;
}
/* Delete the all the requests that the given userId sent */
function allRequestDelete(userId, wait, t, d){
    for(var i = 0; i < wait.length; i++){
        var requestedId = wait[i];
        var query = {"userId" : parseInt(requestedId, 10),
                     "time" : t,
                     "date" : d};
        userDb.collection("match_clt").find(query).toArray((err,result) => {
            if (err) {return err;}
            result = JSON.stringify(result);
            var request = result.request;
            /* Find the id and delete it */
            for(var j = 0; j < request.length; j++){
                if(parseInt(request[j], 10) == parseInt(userId, 10)){
                    request.splice(j,1);
                    break;
                }
            }
            userDb.collection("matchs_clt").updateOne(query, request,(err, result) => {
                if (err) {
                    return err; 
                }
            })
        })
    }
}
function allWaitDelete(userId, request, t, d){
    for(var i = 0; i < request.length; i++){
        var waitedId = request[i];
        var query = {"userId" : parseInt(waitedId, 10),
                     "time" : t,
                     "date" : d};
        userDb.collection("match_clt").find(query).toArray((err,result) => {
            if (err) {return err;}
            result = JSON.stringify(result);
            var wait = result.wait;
            /* Find the id and delete it */
            for(var j = 0; j < wait.length; j++){
                if(parseInt(wait[j], 10) == parseInt(userId, 10)){
                    wait.splice(j,1);
                    break;
                }
            }
            userDb.collection("matchesClt").updateOne(query, wait,(err, result) => {
                if (err) {
                    return err;
                } 
            })
        })
    }
}
/* Delete the matching of 2 people */
function personMatchDelete(userId, t, d){
    var query = {"userId" : parseInt(userId, 10),
                 "time" : t,
                 "date" : d};
    var newValues = {$set:{"match" : null}};
    userDb.collection("matchesClt").updateOne(query, newValues,(err, result) => {
        if (err) {return 1;}
        return 0; 
    })
}
/*
 *  Delete the the matching with given time and userId.
 *  Modify other userId matches as needed.
 *  This will call for allRequestDelete, allWaitDelete, and personMatchDelete
 */
function matchesDelete(uid, eid){
    /* Read the match object into an object */
    query = {"userId" : uid,
             "eventId" : eid};
    userDb.collection("match_clt").find(query).toArray((err,result) => {
        if (err) {return err;}
        var matches = JSON.stringify(result);
        var wait = matches.wait;            /* Will later update the request list of people that this person requested */
        var request = matches.request;      /* Delete this list won't affect other people's matches */
        var matchPerson = matches.match;   /* Will later update the matched person's "match" to NULL  */
        var t = matches.time;
        var d = matches.date;
          /* Delete requests and waits to others */
        allRequestDelete(uid, wait, t, d);
        allWaitDelete(uid, request, t, d);
          /* Delete the matching person */
        if(matchPerson != null) personMatchDelete(matchPerson, t, d);

        /* Delete the match object */
        var query = {"userId" : uid, "time" : t, "date" : d};
        userDb.collection("scheduleClt").deleteOne(query, (err, result) => {
            if (err) {return err;}
        })
    })

}
/*______________________________________________________________________________________
 *  End of helper funtions used for the match algorithm
 *______________________________________________________________________________________*/

/*---------------------------- Preferences Collection ---------------------------- */

/*
 * Post the preferences of the user with userId.
 *
 * Will return an error if...
 * - the user does not exist in the database
 * - the sum of kindness, patience and hardWorking does not equal 12
 * - you send a sex that is not in range
 */
app.post("/user/:userId/preferences", (req,res) => {

    var userQuery = {userId : parseInt(req.params.userId, 10)};

    /* Check if the user exists in the database */
    userDb.collection("infoClt").find(userQuery).toArray((err, user) => {

        if (doesntExist(user)){
            res.status(400).send("You are posting user preferences for a user that does not exist in the database (┛ಠ_ಠ)┛彡┻━┻\n");
            return;
        }

        if (doesntExist(req.body)){
            res.status(400).send("The body sent has a null element (┛ಠ_ಠ)┛彡┻━┻\n");
            return;
        }

        if (!isAcceptablePreferences(parseFloat(req.body.kindness), parseFloat(req.body.patience), parseFloat(req.body.hardWorking)) ){
            res.status(400).send("kindness, patience and hardWorking do not add up to 12 (┛ಠ_ಠ)┛彡┻━┻\n");
            return;
        }

        if (parseInt(req.body.sex, 10) < 0 || parseInt(req.body.sex, 10) > 2) {
            res.status(400).send("THERE ARE ONLY 3 SEXES (FOR PREFERENCES) (┛ಠ_ಠ)┛彡┻━┻\n");
            return;
        }

        /* Add the users preferences */
        userDb.collection("preferencesClt").insertOne(
            {"userId"      : parseInt(req.params.userId, 10),
             "kindness"     : parseFloat(req.body.kindness),
             "patience"     : parseFloat(req.body.patience),
             "hardWorking" : parseFloat(req.body.hardWorking),
             "courses"      : req.body.courses,
             "sex"          : parseInt(req.body.sex, 10),
             "yearLevel"   : req.body.yearLevel},(err, result) => {
         if (err) {return err;}
         res.status(200).send("Preferences have been added. ٩(^ᴗ^)۶\n");
        })
    })
})

/*
 * Get the preferences of the user with userId.
 *
 * Below is a sample JSON output:
 *
 * {'userId' : 0,
 *  'kindness' : 2.0,
 *  'patience' : 6.0,
 *  'hardWorking' : 4.0,
 *  'courses' : ['CPEN 321', 'CPEN 331', 'CPEN 311', 'ELEC 221', ...],
 *  'sex' : 1,
 *  'yearLevel' : [3, 4, ...]}
 */
app.get("/user/:userId/preferences", (req,res) => {

    var userQuery = {userId : parseInt(req.params.userId, 10)};

    userDb.collection("preferencesClt").find(userQuery).toArray((err, user) => {
        if (doesntExist(user)){
            res.status(400).send("You are trying to GET preferences of a user that doesn't exist in the database (┛ಠ_ಠ)┛彡┻━┻\n");
            return;
        } else {
            res.send(user);
        }
    })
})

/*
 * Update the preferences of the user with userId.
 *
 * Below is a sample JSON input:
 *
 * {'kindness' : 2,
 *  'patience' : 6,
 *  'hardWorking' : 4,
 *  'courses' : ['CPEN 321', 'CPEN 331', 'CPEN 311', 'ELEC 221', ...],
 *  'sex' : 0,
 *  'yearLevel' : [3, 4, ...]}
 */
app.put("/user/:userId/preferences", (req,res) => {
    var userQuery = {"userId" : parseInt(req.params.userId, 10)};
    var newValues = {$set: req.body};

    /* Check if the user exists in the database */
    userDb.collection("infoClt").find(userQuery).toArray((err, user) => {

        if (doesntExist(req.body)){
            res.status(400).send("you sent a null body (┛ಠ_ಠ)┛彡┻━┻\n");
            return;
        }

        if (doesntExist(user)){
            res.status(400).send("You are updating user preferences for a user that does not exist in the database (┛ಠ_ಠ)┛彡┻━┻\n");
            return;
        }

        if (!isAcceptablePreferences(parseFloat(req.body.kindness, 10), parseFloat(req.body.patience, 10), parseFloat(req.body.hardWorking, 10)) ){
            res.status(400).send("kindness, patience and hardWorking do not add up to 12 (┛ಠ_ಠ)┛彡┻━┻\n");
            return;
        }

        /* No errors, update the user preferences */
        userDb.collection("preferencesClt").updateOne(userQuery, newValues,(err, result) => {
            if (err) {return err;}
            res.send("Preferences have been updated. ٩(^ᴗ^)۶\n");
        })
    })
})

/*---------------------------- Info Collection ---------------------------- */

/*
 * Get the user with userId's information.
 *
 * Below is a sample JSON output:
 *
 * {'yearLevel' : 3,
 *  'courses' : ['CPEN 321', 'CPEN 331', 'CPEN 311', 'ELEC 221', ...],
 *  'sex' : 0,
 *  'numberOfRatings' : 15,
 *  'kindness' : 3.4,
 *  'patience' : 7.6,
 *  'hardWorking' : 1.0,
 *  'authenticationToken' : ‘abcdef123456789’,
 *  'password' : ‘johndoe@123’,
 *  'userId' : 0,
 *  'email' : ‘john.doe@gmail.com’,
 *  'name' : 'John Doe'}
 */
app.get("/user/:userId/info", (req,res) => {
    userDb.collection("infoClt").find({ userId : parseInt(req.params.userId, 10)}).toArray((err, userInfo) => {
        if (doesntExist(userInfo)){
            res.status(400).send("You are trying to get user info for a user that does not exist in the database (┛ಠ_ಠ)┛彡┻━┻\n");
            return;
        }
        if (err) {return err;}
        res.send(userInfo);
    })
})

/*
 * Sign up a new user. Also initialize thier matches to no one.
 *
 * Below is a sample JSON input:
 *
 * {'yearLevel' : 3,
 *  'courses' : ['CPEN 321', 'CPEN 331', 'CPEN 311', 'ELEC 221', ...],
 *  'sex' : 0,
 *  'numberOfRatings' : 15,
 *  'kindness' : 3.4,
 *  'patience' : 7.6,
 *  'hardWorking' : 1.0,
 *  'authenticationToken' : ‘abcdef123456789’,
 *  'password' : ‘johndoe@123’,
 *  'email' : ‘john.doe@gmail.com’,
 *  'name' : 'John Doe'}
 */
app.post("/user/:userId", (req,res) => {

    userDb.collection("infoClt").find({ userId : parseInt(req.params.userId, 10)}).toArray((err, userInfo) => {
        if (doesntExist(req.body)){
            res.status(400).send("The body sent has a null element (┛ಠ_ಠ)┛彡┻━┻\n");
            return;
        }

        if (!isAcceptablePreferences(parseFloat(req.body.kindness), parseFloat(req.body.patience), parseFloat(req.body.hardWorking)) ){
            res.status(400).send("kindness, patience and hardWorking do not add up to 12 (┛ಠ_ಠ)┛彡┻━┻\n");
            return;
        }

        if (parseInt(req.body.sex, 10) < 0 || parseInt(req.body.sex, 10) > 1) {
            res.status(400).send("THERE ARE ONLY 2 SEXES (┛ಠ_ಠ)┛彡┻━┻\n");
            return;
        }

        var id = parseInt(req.params.userId, 10);
        userDb.collection("infoClt").insertOne(
            {"yearLevel"           : req.body.yearLevel,
             "sex"                  : parseInt(req.body.sex, 10),
             "courses"              : req.body.courses,
             "numberOfRatings"      : parseInt(req.body.numberOfRatings, 10),
             "kindness"             : parseFloat(req.body.kindness),
             "patience"             : parseFloat(req.body.patience),
             "hardWorking"         : parseFloat(req.body.hardWorking),
             "authenticationToken" : req.body.authenticationToken,
             "password"             : req.body.password,
             "userId"              : id,
             "email"                : req.body.email,
             "name"                 : req.body.name},(err, result) => {


         if (err) {return err;}
            res.send("The user has been added to the database!");
        })
    })
})

/*
 * Update the information of user with userId's information.
 *
 * Below is a sample JSON input:
 *
 * {'yearLevel' : 3,
 *  'courses' : ['CPEN 321', 'CPEN 331', 'CPEN 311', 'ELEC 221', ...],
 *  'sex' : 0,
 *  'numberOfRatings' : 15,
 *  'kindness' : 3.4,
 *  'patience' : 7.6,
 *  'hardWorking' : 1.0,
 *  'authenticationToken' : ‘abcdef123456789’,
 *  'password' : ‘johndoe@123’,
 *  'userId' : 0,
 *  'email' : ‘john.doe@gmail.com’,
 *  'name' : 'John Doe'}
 */
app.put("/user/:userId/info", (req,res) => {
    var query = {userId : parseInt(req.params.userId, 10)};
    var newValues = {$set: {yearLevel           : parseInt(req.body.yearLevel, 10),
                            sex                  : parseInt(req.body.sex, 10),
                            courses              : req.body.courses,
                            numberOfRatings    : parseInt(req.body.numberOfRatings, 10),
                            kindness             : parseFloat(req.body.kindness, 10),
                            patience             : parseFloat(req.body.patience, 10),
                            hardWorking         : parseFloat(req.body.hardWorking, 10),
                            authenticationToken : req.body.authenticationToken,
                            password             : req.body.password,
                            email                : req.body.email,
                            name                 : req.body.name}};

    userDb.collection("infoClt").find({ userId : parseInt(req.params.userId, 10)}).toArray((err, userInfo) => {
        if (!doesntExist(userInfo)){
            res.status(400).send("The user with this userId already exists in the database (┛ಠ_ಠ)┛彡┻━┻\n");
            return;
        }
        if (doesntExist(req.body)){
            res.status(400).send("The body sent has a null element (┛ಠ_ಠ)┛彡┻━┻\n");
            return;
        }

        if (!isAcceptablePreferences(parseFloat(req.body.kindness, 10), parseFloat(req.body.patience, 10), parseFloat(req.body.hardWorking, 10)) ){
            res.status(400).send("kindness, patience and hardWorking do not add up to 12 (┛ಠ_ಠ)┛彡┻━┻\n");
            return;
        }

        if (parseInt(req.body.sex, 10) < 0 || parseInt(req.body.sex, 10) > 1) {
            res.status(400).send("THERE ARE ONLY 2 SEXES (┛ಠ_ಠ)┛彡┻━┻\n");
            return;
        }

        userDb.collection("infoClt").updateOne(query, newValues,(err, result) => {
             if (err) {return err;}
             res.send("The user info has been updated! ヽ(＾Д＾)ﾉ\n");
        })
    })
})

/*
 *  Delete an user - delete all information of that user
 *  This take no arguments
 *
 *  NOTE: Either
 *  - the front end will call for other delete request for schedule,
 *  preference before calling this
 *  - or this request will have to handle all deletes
 *  ----> Use the former one for now
 */
app.delete("/user/:userId/info", (req,res) => {
    var query = {"userId" : parseInt(req.params.userId, 10)};
    console.log(parseInt(req.params.userId, 10));
    scheduleDb.collection("infoClt").deleteOne(query, (err, result) => {
        if (err) {return err;}
        res.send("deleted the user: ", parseInt(req.params.userId, 10));
    })
})

/*---------------------------- Matches Collection ---------------------------- */

/*
 * Get a sorted list of the user with userId's potential,
 * waiting and current matches.
 *
 * Below is a sample JSON input:
 *  {'userId’: 0,
 *   'yearLevel' : 3,
 *  'eventId': 2,
 *  'kindness' : 3,
 *  'hardWorking' : 3,
 *  'patience' : 6}
 *
 *  Tung: can you change this so it doesnt require a body to work
 */
app.get("/user/:userId/matches/potentialMatches", (req,res) => {
    /*_________________________________________________________
     * Get the info array of standard vars from the userId
     *_________________________________________________________ */
    var query = {"yearLevel" : req.body.yearLevel,
                 "sex" : req.body.sex};
    /* Filter all standard criteria to an array */
    userDb.collection("infoClt").find(query).toArray((err,inforArray) => {
        if (err) {return err;}

        var info = inforArray;

    var timeDateQuery = {"userId" : parseInt(req.body.userId, 10),
                           "eventId" : parseInt(req.body.eventId, 10)};

    scheduleDb.collection("scheduleClt").find(timeDateQuery).toArray((err, userScheduleEvent) => {

      if (userScheduleEvent[0] == null){
        res.send("There are no users in the database\n");
        return;
      } else {
      var t = userScheduleEvent[0].time;
      var d = userScheduleEvent[0].date;
    }

    /*_________________________________________________________
     * Get the schedule array of specific time
     *_________________________________________________________ */
    var query = {"time" : t,
                 "date" : d,
                 "course" : req.body.course};

    /* Filter all standard time to an array */
    scheduleDb.collection("scheduleClt").find(query).toArray((err,scheduleArray) => {
        if (err) {return err;}
        /* the user cannot be a potential match of him/herself */
        var schedule = scheduleArray;

    /*_________________________________________________________
     * Call the time-filter function
     * Call for the function generateMatch which sort all the matches
     * and return an array "ret" of potential matches and put that into the database
     *_________________________________________________________ */
    var stdMatchArray = timeFilterMatch(info, schedule, parseInt(req.body.userId, 10));

    var ret = generateMatch(req.body.kindness, req.body.hardWorking, req.body.patience, stdMatchArray);

    var query = {"userId" : parseInt(req.body.userId, 10),
                 "eventId" : parseInt(req.body.eventId, 10)};
    var newValues = {$set:{"potentialMatches" : ret}};
    userDb.collection("matchesClt").updateOne(query, newValues,(err, result) => {
        if(req.body == null){
            res.status(400).send("(┛ಠ_ಠ)┛彡┻━┻\n");
            return;}
    /* Return the potential match array */
    userDb.collection("matchesClt").find(query).toArray((err,result) => {
        if (err) {return err;}
        /* return the potential matches */
        res.send(result);
    }) }) }) }) });
})


/*
 * Match user with userId userIdA with user with userId userIdB.
 *
 * Update currentlyMatchedWith array for user_a and user_b
 *
 * Sample JSON input:
 * { "eventId_a : 0, "eventId_b" : 2}
 * Adam: to test
 */
app.post("/user/:userIdA/matches/:userIdB", (req,res) => {
    var queryUserA = { userId : parseInt(req.params.userIdA, 10), "eventId" : parseInt(req.body.eventId_a, 10)};
    var queryUserB = { userId : parseInt(req.params.userIdB, 10), "eventId" : parseInt(req.body.eventId_b, 10)};

    var userAMatchDoc;
    var userBMatchDoc;

    /* Get user_a's match document for a specific time and date */
    userDb.collection("matchesClt").find(queryUserA).toArray((err, a) => {
        if (err) {return err;}
        if (doesntExist(a)){
            res.send("User A doesn't exist\n");
            return;
        }
        userAMatchDoc = a[0];

        /* Get user_b's match document for a specific time and date */
        userDb.collection("matchesClt").find(queryUserB).toArray((err, b) => {
            if (err) {return err;}
            if (doesntExist(b)){
                res.send("User B doesn't exist\n");
                return;
            }
            userBMatchDoc = b[0];


            /* If user_b has already requested to match with user_a and is waiting */
            if (userBMatchDoc["wait"].includes(parseInt(req.params.userIdA, 10))) {

                /* user_b is user_a's match */
                userAMatchDoc["match"] = parseInt(req.params.userIdB, 10);
                /* user_a to user_b's match */
                userBMatchDoc["match"] = parseInt(req.params.userIdA, 10);

                userBMatchDoc["wait"].splice(userBMatchDoc["wait"].indexOf(parseInt(req.params.userIdA, 10)), 1);
                userAMatchDoc["request"].splice(userAMatchDoc["request"].indexOf(parseInt(req.params.userIdB, 10)), 1);

            }
            else {
                /* user_a has requested to match with user_b*/
                userBMatchDoc["request"].push(parseInt(req.params.userIdA, 10));

                /* user_a is waiting to match with user_b */
                userAMatchDoc["wait"].push(parseInt(req.params.userIdB, 10));

            }

            /* Update user_a's matches */
            userDb.collection("matchesClt").updateOne(queryUserA, {$set: {match : userAMatchDoc.match, request : userAMatchDoc.request, wait : userAMatchDoc.wait}}, (err, updateResultA) => {
                if (err) return err;

                    /* Update user_b's matches */
                userDb.collection("matchesClt").updateOne(queryUserB, {$set: {match : userBMatchDoc.match, request : userBMatchDoc.request, wait : userBMatchDoc.wait}}, (err, updateResultB) => {
                    if (err) return err;

                    res.send("Successfully added matches.");
                })
            })
        })
    })
})

/*
 * Get who the user is currently matched with.
 * Adam: To test
 */
app.get("/user/:userId/matches/currentlyMatchedWith", (req,res) => {
    var curMatches = [];
    var i;
    /* Find all the match documents for a specified user */
    userDb.collection("matchesClt").find({ userId : parseInt(req.params.userId, 10)}).toArray((err, matches) => {
        if (err) return err;
        if (doesntExist(matches)){
            res.send("The user with userId doesnt have any matches\n");
        }
        /* Generate the current matches */
        for (i = 0; i < matches.length-1; i++){
            /* if the user has a match */
            if (matches[i]["match"] != null) {
                /* Add the match to the list */
                curMatches.append(
                    {"time" : matches[i]["time"],
                    "date" : matches[i]["date"],
                    "match" : matches[i]["match"]});
            }
        }
        /* Return JSON object*/
        res.send({"current_matches" : curMatches});
    })
})

/*
 * Get who the user is waiting to match with
 * Adam: To test
 */
app.get("/user/:userId/matches/userIsWaitingToMatchWith", (req,res) => {
    userDb.collection("matchesClt").find({ userId : parseInt(req.params.userId, 10)}).toArray((err, result) => {
        if (err) return err;
        res.send(result["wait"]);
    })
})

/*
 * Unmatch user with userId with user with matchId and vice versa.
 * This will call helper function personMatchDelete()
 * Tung: Can you test this
 */
app.delete("/user/:userId/matches/:matchId", (req,res) => {
    var err1 = personMatchDelete(req.param.userIdA, req.body.time, req.body.date);
    var err2 = personMatchDelete(req.param.userIdB, req.body.time, req.body.date);
    if(err1 || err2) {return err};
    res.send("Successfully unmatch.");
})



 app.get("/get_all_users",  (req,res) => {
     userDb.collection("infoClt").find().toArray((err, a) => {
         console.log(a)
         res.send(a)
     })
 })

 app.delete("/delete_all_users",  (req,res) => {
     userDb.collection("infoClt").deleteMany({},(err, a) => {
         console.log(a)
         res.send(a)
     })
 })

app.get("/get_all_schedules",  (req,res) => {
    scheduleDb.collection("scheduleClt").find().toArray((err, a) => {
        console.log(a)
        res.send(a)
    })
})

app.get("/get_all_matches",  (req,res) => {
    userDb.collection("matchesClt").find().toArray((err, a) => {
        console.log(a)
        res.send(a)
    })
})


app.delete("/delete_all_schedules",  (req,res) => {
    scheduleDb.collection("scheduleClt").deleteMany({},(err, a) => {
        console.log(a)
        res.send(a)
    })
})

app.delete("/delete_all_matches",  (req,res) => {
    userDb.collection("matchesClt").deleteMany({},(err, a) => {
        console.log(a)
        res.send(a)
    })
})


/*---------------------------- Schedule Collection ---------------------------- */


/*
 * Get the user with userId's schedule at a specific study event.
 *
 * Below is a sample JSON output:
 *
 * { ‘userId’ : 0,
 *   'eventId' : 0,
 *   'time' : '13:00 - 14:00',
 *   'date' : 'Oct. 4, 2019'
 *   'course' : 'CPEN 321',
 *   'location' : 'Irving K. Barber'}
 */
app.get("/schedule/:userId/:eventId", (req,res) => {
    var query = {eventId : parseInt(req.body.eventId, 10), userId : parseInt(req.params.userId, 10)};

    scheduleDb.collection("scheduleClt").find(query).toArray((err, result) => {
        if (doesntExist(result)){
            res.send("The study event with eventId for user with userId doesn't exist\n")
            return;
        }
        if (err) return err;
        res.send(result);
    })
})

/*
 * Get the user with userId's whole schedule.
 *
 * Below is a sample JSON output:
 *
 * { ‘userId’ : 0,
 *   'eventId' : 0,
 *   'time' : '13:00 - 14:00',
 *   'date' : 'Oct. 4, 2019'
 *   'course' : 'CPEN 321',
 *   'location' : 'Irving K. Barber'}
 */
app.get('/schedule/:userId', (req,res) => {
    var query = {userId : parseInt(req.params.userId, 10)};
    scheduleDb.collection("scheduleClt").find(query).toArray((err, schedule) => {
        if (err) return err;
        if (doesntExist(schedule)){
            res.send("The user with userId doesn't have any study events\n")
            return;
        }
        res.send(schedule);
    })
})

/*
 * Add an event the schedule of the user with with userId.\
 */
app.post('/user/:userId/schedule', (req,res) => {

    if (doesntExist(req.body)){
        res.status(400).send("The body sent has a null element (┛ಠ_ಠ)┛彡┻━┻\n");
        return;
    }

    userDb.collection("infoClt").find({ userId : parseInt(req.params.userId, 10)}).toArray((err, userInfo) => {

        if (doesntExist(userInfo)){
            res.send("You are trying to post a schedule to a user that doesnt exist (┛ಠ_ಠ)┛彡┻━┻\n")
            return;
        }

        /* Create schedule object */
        scheduleDb.collection("scheduleClt").insertOne(
            {'userId' : parseInt(req.params.userId, 10),
             'eventId' : parseInt(req.body.eventId, 10),
             'time' : req.body.time,
             'date' : req.body.date,
             'course' : req.body.course,
             'location' : req.body.location},(err, result) => {
            if (err) return err;
            console.log('Schedule added')
        })
        /* Create a match object for that schedule */
        userDb.collection("matchesClt").insertOne(
            {'userId' : parseInt(req.params.userId, 10),
             'eventId' : parseInt(req.body.eventId, 10),
             'time' : req.body.time,
             'date' : req.body.date,
             "wait" : [],
             "request" : [],
             'potentialMatches' : [],
             "match" : -1},(err, result) => {
               if (err) return err;
               console.log('matches document init done')
               res.send("Schedule has been posted!! :)")
        })
    })
})

/*
 * Update the schedule of the user with with userId.
 *
 *  {'time' : '13:00 - 14:00',
 *   'date' : 'Oct. 4, 2019'
 *   'course' : 'CPEN 321',
 *   'location' : 'Irving K. Barber'}
 *
 * Tung: Can you add error checking here
 */
app.put('/schedule/:userId/:eventId', (req,res) => {
    /* First need to delete the current corresponding maches */
    matchesDelete(req.params.userId, req.params.eventId);
    /* Create a new corresponding matches */
    userDb.collection("matchesClt").insertOne( // should this be insert or update?
        {'userId' : parseInt(req.params.userId, 10),
         'eventId' : parseInt(req.params.eventId, 10),
         'time' : req.body.time,
         'date' : req.body.date,
         "wait" : [],
         "request" : [],
         'potentialMatches' : [],
         "match" : -1},(err, result) => {
           if (err) return err;
           console.log('matches document init done')
           res.send("Schedule has been posted")
    })

    /* Actually update the schedule */
    var query = {"userId" : parseInt(req.params.userId, 10), "eventId" : parseInt(req.params.eventId, 10)};
    var newValues = {$set: req.body};
    scheduleDb.collection("scheduleClt").updateOne(query, newValues,(err, result) => {
    if (req.body == null) {
     res.status(400).send("(┛ಠ_ಠ)┛彡┻━┻\n");
     return;
    }
     if (err) return err;
     res.send("Schedules have been updated.\n");
    })
})

/*
 * Delete every event in the user's schedule
 *
 * Tung: Can you add error checking here
 */
app.delete('/user/:userId/schedule/:num_events', (req,res) => {
    /* Delete every single corresponding match */
    for(var i = 0; i < parseInt(req.params.num_events, 10); i++){
      matchesDelete(req.params.userId, i);
    }
    /* Now actually delete the schedule */
    var query = {"userId" : parseInt(req.params.userId, 10)};
    console.log(parseInt(req.params.userId, 10));
    scheduleDb.collection("scheduleClt").deleteOne(query, (err, result) => {
        if (err) return err;
        res.send("deleted the schedule\n");
    })
})

/*
 * Delete a study event with of the user with userId at a certain time and date.
 * !! We will need to find a way to differentiate between study events. !!
 *
 * Tung: Can you add error checking here
 */
app.delete('/user/:userId/schedule/:eventId', (req,res) => {
    /*
     *  Before deleting the schedule, we need to delete the matching first
     *  This function is written in the matches sections
     */
    matchesDelete(parseInt(req.params.userId, 10), parseInt(req.params.eventId, 10));

     /* Now actually delete the schedule */
    var query = {"userId" : req.params.userId, "eventId" : parseInt(req.params.eventId, 10)};
    scheduleDb.collection("scheduleClt").deleteOne(query, (err, result) => {
        if (err) return err;
        res.send("deleted the specific time\n");
        })
    })
