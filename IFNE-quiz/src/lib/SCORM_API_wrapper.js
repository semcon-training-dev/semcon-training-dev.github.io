/* =====================================================================================

SCORM wrapper v1.1.7 by Philip Hutchison, May 2008 (http://pipwerks.com).

Copyright (c) 2008 Philip Hutchison
MIT-style license. Full license text can be found at
http://www.opensource.org/licenses/mit-license.php

This wrapper is designed to work with both SCORM 1.2 and SCORM 2004.

Based on APIWrapper.js, created by the ADL and Concurrent Technologies
Corporation, distributed by the ADL (http://www.adlnet.gov/scorm).

SCORM.API.find() and SCORM.API.get() functions based on ADL code,
modified by Mike Rustici (http://www.scorm.com/resources/apifinder/SCORMAPIFinder.htm),
further modified by Philip Hutchison

======================================================================================== */

var g_dtmInitialized = new Date(); // will be adjusted after initialize

var pipwerks = {}; //pipwerks 'namespace' helps ensure no conflicts with possible other "SCORM" variables
pipwerks.UTILS = {}; //For holding UTILS functions
pipwerks.debug = {
  isActive: true,
}; //Enable (true) or disable (false) for debug mode

pipwerks.SCORM = { //Define the SCORM object
  version: "", //Store SCORM version.
  handleCompletionStatus: true, //Whether or not the wrapper should automatically handle the initial completion status
  handleExitMode: false, //Whether or not the wrapper should automatically handle the exit mode
  handlePersistentConnection: true,
  persistentConnectionInterval: 120000, // Time (in milliseconds) between persistent connection autosave calls
  API: {
    handle: null,
    isFound: false,
  }, //Create API child object
  connection: {
    isActive: false,
  }, //Create connection child object
  data: {
    completionStatus: null,
    exitStatus: null,
  }, //Create data child object
  debug: {} //Create debug child object
};

function getScormVersion() {
  var scorm = pipwerks.SCORM;
  return scorm.version;
}

/* --------------------------------------------------------------------------------
   pipwerks.SCORM.isAvailable
   A simple function to allow Flash ExternalInterface to confirm
   presence of JS wrapper before attempting any LMS communication.

   Parameters: none
   Returns:    Boolean (true)
----------------------------------------------------------------------------------- */

pipwerks.SCORM.isAvailable = function () {
  return true;
};

// ------------------------------------------------------------------------- //
// --- SCORM.API functions ------------------------------------------------- //
// ------------------------------------------------------------------------- //

/* -------------------------------------------------------------------------
   pipwerks.SCORM.API.find(window)
   Looks for an object named API in parent and opener windows

   Parameters: window (the browser window object).
   Returns:    Object if API is found, null if no API found
---------------------------------------------------------------------------- */

pipwerks.SCORM.API.find = function (win) {

  var API = null,
  findAttempts = 0,
  findAttemptLimit = 500,
  traceMsgPrefix = "SCORM.API.find",
  trace = pipwerks.UTILS.trace,
  scorm = pipwerks.SCORM;

  while ((!win.API && !win.API_1484_11) &&
  (win.parent) &&
  (win.parent != win) &&
  (findAttempts <= findAttemptLimit)) {

    findAttempts++;
    win = win.parent;

  }

  if (scorm.version) { //If SCORM version is specified by user, look for specific API

    switch (scorm.version) {

      case "2004":

        if (win.API_1484_11) {

          API = win.API_1484_11;

        } else {

          trace(traceMsgPrefix + ": SCORM version 2004 was specified by user, but API_1484_11 cannot be found.");

        }

        break;

      case "1.2":

        if (win.API) {

          API = win.API;

        } else {

          trace(traceMsgPrefix + ": SCORM version 1.2 was specified by user, but API cannot be found.");

        }

        break;

    }

  } else { //If SCORM version not specified by user, look for APIs

    if (win.API_1484_11) { //SCORM 2004-specific API.

      scorm.version = "2004"; //Set version
      API = win.API_1484_11;

    } else if (win.API) { //SCORM 1.2-specific API

      scorm.version = "1.2"; //Set version
      API = win.API;

    }

  }

  if (API) {

    trace(traceMsgPrefix + ": API found. Version: " + scorm.version);
    trace("API: " + API);

  } else {

    trace(traceMsgPrefix + ": Error finding API. \nFind attempts: " + findAttempts + ". \nFind attempt limit: " + findAttemptLimit);

  }

  return API;

};

/* -------------------------------------------------------------------------
   pipwerks.SCORM.API.get()
   Looks for an object named API, first in the current window's frame
   hierarchy and then, if necessary, in the current window's opener window
   hierarchy (if there is an opener window).

   Parameters:  None.
   Returns:     Object if API found, null if no API found
---------------------------------------------------------------------------- */

pipwerks.SCORM.API.get = function () {

  var API = null,
  win = window,
  find = pipwerks.SCORM.API.find,
  trace = pipwerks.UTILS.trace;

  if (win.parent && win.parent != win) {

    API = find(win.parent);

  }

  if (!API && win.top.opener) {

    API = find(win.top.opener);

  }

  if (API) {

    pipwerks.SCORM.API.isFound = true;

  } else {

    trace("API.get failed: Can't find the API!");

  }

  return API;

};

/* -------------------------------------------------------------------------
   pipwerks.SCORM.API.getHandle()
   Returns the handle to API object if it was previously set

   Parameters:  None.
   Returns:     Object (the pipwerks.SCORM.API.handle variable).
---------------------------------------------------------------------------- */

pipwerks.SCORM.API.getHandle = function () {

  var API = pipwerks.SCORM.API;

  if (!API.handle && !API.isFound) {

    API.handle = API.get();

  }

  return API.handle;

};

// ------------------------------------------------------------------------- //
// --- pipwerks.SCORM.connection functions --------------------------------- //
// ------------------------------------------------------------------------- //

/* -------------------------------------------------------------------------
   pipwerks.SCORM.connection.initialize()
   Tells the LMS to initiate the communication session.

   Parameters:  None
   Returns:     Boolean
---------------------------------------------------------------------------- */

pipwerks.SCORM.connection.initialize = function () {

  var success = false,
  scorm = pipwerks.SCORM,
  completionStatus = pipwerks.SCORM.data.completionStatus,
  trace = pipwerks.UTILS.trace,
  makeBoolean = pipwerks.UTILS.StringToBoolean,
  debug = pipwerks.SCORM.debug,
  traceMsgPrefix = "SCORM.connection.initialize ";

  trace("connection.initialize called.");

  if (!scorm.connection.isActive) {

    var API = scorm.API.getHandle(),
    errorCode = 0;

    if (API) {

      switch (scorm.version) {
        case "1.2":
          success = makeBoolean(API.LMSInitialize(""));
          break;
        case "2004":
          success = makeBoolean(API.Initialize(""));
          break;
      }

      if (success) {

        //Double-check that connection is active and working before returning 'true' boolean
        errorCode = debug.getCode();

        if (errorCode !== null && errorCode === 0) {

          scorm.connection.isActive = true;

          switch (scorm.version) {
            case "1.2":
              success = scorm.set("cmi.core.exit", "suspend");
              break;
            case "2004":
              success = scorm.set("cmi.exit", "suspend");
              break;
          }

          if (scorm.handlePersistentConnection) {
            setInterval(pipwerks.SCORM.save, scorm.persistentConnectionInterval);
          }

          if (scorm.handleCompletionStatus) {

            //Automatically set new launches to incomplete
            completionStatus = pipwerks.SCORM.status("get");

            if (completionStatus) {

              switch (completionStatus) {

              //Both SCORM 1.2 and 2004
                case "not attempted":
                  pipwerks.SCORM.status("set", "incomplete");
                  break;

                  //SCORM 2004 only
                case "unknown":
                  pipwerks.SCORM.status("set", "incomplete");
                  break;

                //Additional options, presented here in case you'd like to use them
                //case "completed"  : break;
                //case "incomplete" : break;
                //case "passed"     : break;	//SCORM 1.2 only
                //case "failed"     : break;	//SCORM 1.2 only
                //case "browsed"    : break;	//SCORM 1.2 only

              }

            }

          }

        } else {

          success = false;
          trace(traceMsgPrefix + "failed. \nError code: " + errorCode + " \nError info: " + debug.getInfo(errorCode));

        }

      } else {

        errorCode = debug.getCode();

        if (errorCode !== null && errorCode !== 0) {

          trace(traceMsgPrefix + "failed. \nError code: " + errorCode + " \nError info: " + debug.getInfo(errorCode));

        } else {

          trace(traceMsgPrefix + "failed: No response from server.");

        }
      }

    } else {

      trace(traceMsgPrefix + "failed: API is null.");

    }

  } else {
    success = true;
    trace(traceMsgPrefix + "aborted: Connection already active.");
  }

  g_dtmInitialized = new Date();

  return success;
};

/* -------------------------------------------------------------------------
   pipwerks.SCORM.connection.terminate()
   Tells the LMS to terminate the communication session

   Parameters:  None
   Returns:     Boolean
---------------------------------------------------------------------------- */

pipwerks.SCORM.connection.terminate = function () {

  var success = false,
  scorm = pipwerks.SCORM,
  exitStatus = pipwerks.SCORM.data.exitStatus,
  completionStatus = pipwerks.SCORM.data.completionStatus,
  trace = pipwerks.UTILS.trace,
  makeBoolean = pipwerks.UTILS.StringToBoolean,
  debug = pipwerks.SCORM.debug,
  traceMsgPrefix = "SCORM.connection.terminate ";

  if (scorm.connection.isActive) {

    var API = scorm.API.getHandle(),
    errorCode = 0;

    if (API) {

      if (scorm.handleExitMode && !exitStatus) {

        if (completionStatus !== "completed" && completionStatus !== "passed") {

          switch (scorm.version) {
            case "1.2":
              success = scorm.set("cmi.core.exit", "suspend");
              break;
            case "2004":
              success = scorm.set("cmi.exit", "suspend");
              break;
          }

        } else {

          switch (scorm.version) {
            case "1.2":
              success = scorm.set("cmi.core.exit", "logout");
              break;
            case "2004":
              success = scorm.set("cmi.exit", "normal");
              break;
          }

        }

      }

      // Always set the exit variable to suspend so that it keeps our suspendData
      switch (scorm.version) {
        case "1.2":
          success = scorm.set("cmi.core.exit", "suspend");
          break;
        case "2004":
          success = scorm.set("cmi.exit", "suspend");
          break;
      }

      switch (scorm.version) {
        case "1.2":
          success = makeBoolean(API.LMSFinish(""));
          break;
        case "2004":
          success = makeBoolean(API.Terminate(""));
          break;
      }

      if (success) {

        scorm.connection.isActive = false;

      } else {

        errorCode = debug.getCode();
        trace(traceMsgPrefix + "failed. \nError code: " + errorCode + " \nError info: " + debug.getInfo(errorCode));

      }

    } else {

      trace(traceMsgPrefix + "failed: API is null.");

    }

  } else {

    trace(traceMsgPrefix + "aborted: Connection already terminated.");

  }

  return success;

};

// ------------------------------------------------------------------------- //
// --- pipwerks.SCORM.data functions --------------------------------------- //
// ------------------------------------------------------------------------- //

/* -------------------------------------------------------------------------
   pipwerks.SCORM.data.get(parameter)
   Requests information from the LMS.

   Parameter: parameter (string, name of the SCORM data model element)
   Returns:   string (the value of the specified data model element)
---------------------------------------------------------------------------- */

pipwerks.SCORM.data.get = function (parameter) {

  var value = null,
  scorm = pipwerks.SCORM,
  trace = pipwerks.UTILS.trace,
  debug = pipwerks.SCORM.debug,
  traceMsgPrefix = "SCORM.data.get(" + parameter + ") ";

  if (scorm.connection.isActive) {

    var API = scorm.API.getHandle(),
    errorCode = 0;

    if (API) {

      switch (scorm.version) {
        case "1.2":
          value = API.LMSGetValue(parameter);
          break;
        case "2004":
          value = API.GetValue(parameter);
          break;
      }

      errorCode = debug.getCode();

      //GetValue returns an empty string on errors
      //Double-check errorCode to make sure empty string
      //is really an error and not field value
      if (value !== "" && errorCode === 0) {

        switch (parameter) {

          case "cmi.core.lesson_status":
          case "cmi.completion_status":
            scorm.data.completionStatus = value;
            break;

          case "cmi.core.exit":
          case "cmi.exit":
            scorm.data.exitStatus = value;
            break;

        }

      } else {

        trace(traceMsgPrefix + "failed. \nError code: " + errorCode + "\nError info: " + debug.getInfo(errorCode));

      }

    } else {

      trace(traceMsgPrefix + "failed: API is null.");

    }

  } else {

    trace(traceMsgPrefix + "failed: API connection is inactive.");

  }

  trace(traceMsgPrefix + " value: " + value);

  return String(value);

};

/* -------------------------------------------------------------------------
   pipwerks.SCORM.data.set()
   Tells the LMS to assign the value to the named data model element.
   Also stores the SCO's completion status in a variable named
   pipwerks.SCORM.data.completionStatus. This variable is checked whenever
   pipwerks.SCORM.connection.terminate() is invoked.

   Parameters: parameter (string). The data model element
               value (string). The value for the data model element
   Returns:    Boolean
---------------------------------------------------------------------------- */

pipwerks.SCORM.data.set = function (parameter, value) {

  var success = false,
  scorm = pipwerks.SCORM,
  trace = pipwerks.UTILS.trace,
  makeBoolean = pipwerks.UTILS.StringToBoolean,
  debug = pipwerks.SCORM.debug,
  traceMsgPrefix = "SCORM.data.set(" + parameter + ") ";

  if (scorm.connection.isActive) {

    var API = scorm.API.getHandle(),
    errorCode = 0;

    if (API) {

      switch (scorm.version) {
        case "1.2":
          success = makeBoolean(API.LMSSetValue(parameter, value));
          break;
        case "2004":
          success = makeBoolean(API.SetValue(parameter, value));
          break;
      }

      if (success) {

        if (parameter === "cmi.core.lesson_status" || parameter === "cmi.completion_status") {

          scorm.data.completionStatus = value;

        }

      } else {

        trace(traceMsgPrefix + "failed. \nError code: " + errorCode + ". \nError info: " + debug.getInfo(errorCode));

      }

    } else {

      trace(traceMsgPrefix + "failed: API is null.");

    }

  } else {

    trace(traceMsgPrefix + "failed: API connection is inactive.");

  }

  trace(traceMsgPrefix + " value: " + value);

  return success;

};

/* -------------------------------------------------------------------------
   pipwerks.SCORM.data.save()
   Instructs the LMS to persist all data to this point in the session

   Parameters: None
   Returns:    Boolean
---------------------------------------------------------------------------- */

pipwerks.SCORM.data.save = function () {

  var success = false,
  scorm = pipwerks.SCORM,
  trace = pipwerks.UTILS.trace,
  makeBoolean = pipwerks.UTILS.StringToBoolean,
  traceMsgPrefix = "SCORM.data.save failed";

  if (scorm.connection.isActive) {

    var API = scorm.API.getHandle();

    reportSessionTime();

    if (API) {

      switch (scorm.version) {
        case "1.2":
          success = makeBoolean(API.LMSCommit(""));
          break;
        case "2004":
          success = makeBoolean(API.Commit(""));
          break;
      }

    } else {

      trace(traceMsgPrefix + ": API is null.");

    }

  } else {

    trace(traceMsgPrefix + ": API connection is inactive.");

  }

  trace("SCORM.data.save: " + success);

  return success;

};

pipwerks.SCORM.status = function (action, status) {

  var success = false,
  scorm = pipwerks.SCORM,
  trace = pipwerks.UTILS.trace,
  traceMsgPrefix = "SCORM.getStatus failed",
  cmi = "";

  if (action !== null) {

    switch (scorm.version) {
      case "1.2":
        cmi = "cmi.core.lesson_status";
        break;
      case "2004":
        cmi = "cmi.completion_status";
        break;
    }

    switch (action) {

      case "get":
        success = pipwerks.SCORM.data.get(cmi);
        break;

      case "set":
        if (status !== null) {

          success = pipwerks.SCORM.data.set(cmi, status);

        } else {

          success = false;
          trace(traceMsgPrefix + ": status was not specified.");

        }

        break;

      default:
        success = false;
        trace(traceMsgPrefix + ": no valid action was specified.");

    }

  } else {

    trace(traceMsgPrefix + ": action was not specified.");

  }

  return success;

};

// ------------------------------------------------------------------------- //
// --- pipwerks.SCORM.debug functions -------------------------------------- //
// ------------------------------------------------------------------------- //

/* -------------------------------------------------------------------------
   pipwerks.SCORM.debug.getCode
   Requests the error code for the current error state from the LMS

   Parameters: None
   Returns:    Integer (the last error code).
---------------------------------------------------------------------------- */

pipwerks.SCORM.debug.getCode = function () {

  var API = pipwerks.SCORM.API.getHandle(),
  scorm = pipwerks.SCORM,
  trace = pipwerks.UTILS.trace,
  code = 0;

  if (API) {

    switch (scorm.version) {
      case "1.2":
        code = parseInt(API.LMSGetLastError(), 10);
        break;
      case "2004":
        code = parseInt(API.GetLastError(), 10);
        break;
    }

  } else {

    trace("SCORM.debug.getCode failed: API is null.");

  }

  return code;

};

/* -------------------------------------------------------------------------
   pipwerks.SCORM.debug.getInfo()
   "Used by a SCO to request the textual description for the error code
   specified by the value of [errorCode]."

   Parameters: errorCode (integer).
   Returns:    String.
----------------------------------------------------------------------------- */

pipwerks.SCORM.debug.getInfo = function (errorCode) {

  var API = pipwerks.SCORM.API.getHandle(),
  scorm = pipwerks.SCORM,
  trace = pipwerks.UTILS.trace,
  result = "";

  if (API) {

    switch (scorm.version) {
      case "1.2":
        result = API.LMSGetErrorString(errorCode.toString());
        break;
      case "2004":
        result = API.GetErrorString(errorCode.toString());
        break;
    }

  } else {

    trace("SCORM.debug.getInfo failed: API is null.");

  }

  return String(result);

};

/* -------------------------------------------------------------------------
   pipwerks.SCORM.debug.getDiagnosticInfo
   "Exists for LMS specific use. It allows the LMS to define additional
   diagnostic information through the API Instance."

   Parameters: errorCode (integer).
   Returns:    String (Additional diagnostic information about the given error code).
---------------------------------------------------------------------------- */

pipwerks.SCORM.debug.getDiagnosticInfo = function (errorCode) {

  var API = pipwerks.SCORM.API.getHandle(),
  scorm = pipwerks.SCORM,
  trace = pipwerks.UTILS.trace,
  result = "";

  if (API) {

    switch (scorm.version) {
      case "1.2":
        result = API.LMSGetDiagnostic(errorCode);
        break;
      case "2004":
        result = API.GetDiagnostic(errorCode);
        break;
    }

  } else {

    trace("SCORM.debug.getDiagnosticInfo failed: API is null.");

  }

  return String(result);

};

// ------------------------------------------------------------------------- //
// --- Shortcuts! ---------------------------------------------------------- //
// ------------------------------------------------------------------------- //

// Because nobody likes typing verbose code.

pipwerks.SCORM.init = pipwerks.SCORM.connection.initialize;
pipwerks.SCORM.get = pipwerks.SCORM.data.get;
pipwerks.SCORM.set = pipwerks.SCORM.data.set;
pipwerks.SCORM.save = pipwerks.SCORM.data.save;
pipwerks.SCORM.quit = pipwerks.SCORM.connection.terminate;

// ------------------------------------------------------------------------- //
// --- pipwerks.UTILS functions -------------------------------------------- //
// ------------------------------------------------------------------------- //

/* -------------------------------------------------------------------------
   pipwerks.UTILS.StringToBoolean()
   Converts 'boolean strings' into actual valid booleans.

   (Most values returned from the API are the strings "true" and "false".)

   Parameters: String
   Returns:    Boolean
---------------------------------------------------------------------------- */

pipwerks.UTILS.StringToBoolean = function (string) {
  switch (string.toLowerCase()) {
    case "true":
    case "yes":
    case "1":
      return true;
    case "false":
    case "no":
    case "0":
    case null:
      return false;
    default:
      return Boolean(string);
  }
};

/* -------------------------------------------------------------------------
   pipwerks.UTILS.trace()
   Displays error messages when in debug mode.

   Parameters: msg (string)
   Return:     None
---------------------------------------------------------------------------- */

pipwerks.UTILS.trace = function (msg) {

  if (pipwerks.debug.isActive) {

    //Firefox users can use the 'Firebug' extension's console.
    if (window.console) {
      console.log(msg);
    } else {
      //alert(msg);
    }

  }
};

/*******************************************************************************
 *************************** FUNKIS FUNCTIONS BELOW *****************************
 *******************************************************************************/

/*******************************************************************************
**
** Function doLMSSetAnswer(questionidentifier, questionanswer)
** Inputs:  questionidentifier: unik identifierare f�r fr�gan
**          questionanswer: svaret som ska lagras
** Return:  CMIBoolean true if successful
**          CMIBoolean false if failed.
**
** Description:
Sparar ett svar f�r den angivna fr�gan och knytar svaret till den inloggade studenten. Man kan spara flera olika svar f�r samma fr�ga och person (vid t ex en multiple choice fr�ga d�r man kan ange flera svarsalternativ) genom att anropa denna funktion flera g�nger. Returnerar ett boolskt v�rde, true om sparningen gick bra, annars false.

**
*******************************************************************************/

function doLMSSetAnswer(questionidentifier, questionanswer) {
  var API = pipwerks.SCORM.API.getHandle(),
  scorm = pipwerks.SCORM,
  trace = pipwerks.UTILS.trace,
  result = "";

  if (API == null) {
    alert("Unable to locate the LMS's API Implementation.\nLMSSetValue was not successful.");
    return;
  } else {
    var result = API.LMSSetAnswer(questionidentifier, questionanswer);
    if (result.toString() != "true") {
      var err = ErrorHandler();
    }

    return result.toString();;
  }

}

/*******************************************************************************
**
** Function doLMSGetAnswers(questionidentifier)
** Inputs:  questionidentifier: den unika identifieraren f�r fr�gan som man vill ha alla studenternas svar p�
** Return:  Array if successful
**          CMIBoolean false if failed.
**
** Description:
Returnerar alla svar fr�n alla anv�ndare p� den angivna fr�gan i form av en array d�r varje element i arrayen �r en str�ng med en students (samlade) svar. Har en student angett flera svar p� samma fr�ga separeras dessa med ett kommatecken inom samma arrayelement. Om n�got har g�tt fel under h�mtningen returneras det boolska v�rdet false.
**
*******************************************************************************/

function doLMSGetAnswers(questionidentifier) {
  var API = pipwerks.SCORM.API.getHandle(),
  scorm = pipwerks.SCORM,
  trace = pipwerks.UTILS.trace,
  result = "";

  if (API == null) {
    alert("Unable to locate the LMS's API Implementation.\nLMSGetValue was not successful.");
    return "";
  } else {
    var value = API.LMSGetAnswers(questionidentifier);
    var errCode = API.LMSGetLastError().toString();
    if (errCode != _NoError) {
      // an error was encountered so display the error description
      var errDescription = API.LMSGetErrorString(errCode);
      alert("LMSGetAnswers(" + questionidentifier + ") failed. \n" + errDescription);
      return "";
    } else {
      //alert("The getted value for "+questionidentifier+" = "+value.toString());
      return value.toString();
    }
  }
}

/****************************************************************************

Function reportSessionTimeAndFinish() {

** Description: Called from HTML body tag  - onunload="reportSessionTimeAndFinish()"


******************************************************************************/

function MillisecondsToCMIDuration(n) {
  //Convert duration from milliseconds to 0000:00:00.00 format
  var hms = "";
  var dtm = new Date();
  dtm.setTime(n);
  var h = "000" + Math.floor(n / 3600000);
  var m = "0" + dtm.getMinutes();
  var s = "0" + dtm.getSeconds();
  var cs = "0" + Math.round(dtm.getMilliseconds() / 10);
  hms = h.substr(h.length - 4) + ":" + m.substr(m.length - 2) + ":";
  hms += s.substr(s.length - 2) + "." + cs.substr(cs.length - 2);
  return hms;
}

function centisecsToISODuration(n) {
  // Note: SCORM and IEEE 1484.11.1 require centisec precision
  // Months calculated by approximation based on average number
  // of days over 4 years (365*4+1), not counting the extra day
  // every 1000 years. If a reference date was available,
  // the calculation could be more precise, but becomes complex,
  // since the exact result depends on where the reference date
  // falls within the period (e.g. beginning, end or ???)
  // 1 year ~ (365*4+1)/4*60*60*24*100 = 3155760000 centiseconds
  // 1 month ~ (365*4+1)/48*60*60*24*100 = 262980000 centiseconds
  // 1 day = 8640000 centiseconds
  // 1 hour = 360000 centiseconds
  // 1 minute = 6000 centiseconds
  n = Math.max(n, 0); // there is no such thing as a negative duration
  var str = "P";
  var nCs = n;

  // Next set of operations uses whole seconds
  var nY = Math.floor(nCs / 3155760000);
  nCs -= nY * 3155760000;
  var nM = Math.floor(nCs / 262980000);
  nCs -= nM * 262980000;
  var nD = Math.floor(nCs / 8640000);
  nCs -= nD * 8640000;
  var nH = Math.floor(nCs / 360000);
  nCs -= nH * 360000;
  var nMin = Math.floor(nCs / 6000);
  nCs -= nMin * 6000;

  // Now we can construct string
  if (nY > 0) str += nY + "Y";
  if (nM > 0) str += nM + "M";
  if (nD > 0) str += nD + "D";
  if ((nH > 0) || (nMin > 0) || (nCs > 0)) {
    str += "T";
    if (nH > 0) str += nH + "H";
    if (nMin > 0) str += nMin + "M";
    if (nCs > 0) str += (nCs / 100) + "S";
  }

  if (str == "P") str = "PT0H0M0S";

  // technically PT0S should do but SCORM test suite assumes longer form.
  return str;
}

function reportSessionTime() {
  var API = pipwerks.SCORM.API.getHandle(),
  scorm = pipwerks.SCORM,
  trace = pipwerks.UTILS.trace,
  result = "";

  var dtm = new Date();
  var n = dtm.getTime() - g_dtmInitialized.getTime();

  if (API) {

    switch (scorm.version) {
      case "1.2":
        pipwerks.SCORM.set("cmi.core.session_time", MillisecondsToCMIDuration(n));
        break;
      case "2004":
        pipwerks.SCORM.set("cmi.session_time", centisecsToISODuration(Math.floor(n / 10)));
        break;
    }

  } else {

    trace("reportSessionTimeAndFinish failed: API is null.");

  }
}

function reportSessionTimeAndFinish() {
  pipwerks.SCORM.save();
  pipwerks.SCORM.quit();
}
