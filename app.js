#!/usr/bin/env node

var cli = require('cli'),
    Q = require('q'),
    fs = require('fs'),
    path = require('path'),
    jqd = require('jquery-dom'),
    request = Q.denodeify(require('request')),
    Diacritical = require('diacritical'),
    diacritical = new Diacritical,
    fileList = [],

    accents_url = 'http://diacritics.iriscouch.com/accents/_design/terms_list/_view/terms_list',
    library_path = 'library',
    titles = {},
    report = {},
    pars = [];
    dictionary = [];


// load in additional cli capabilities
cli.enable('help', 'version', 'status');
var options = cli.parse();

//console.log(diacritical);
//return;

(function() {

  var BOOK_TITLES = {
      'slh': 'Summons of the Lord of Hosts',
      'ki' : 'Kitáb-i-Íqán',
      'pup': 'Proclamation of Universal Peace',
      'pt' : 'Paris Talks',
      'sdc': 'Secret of Divine Civilization',
      'swa': 'Selections from the Writings of ‘Abdu’l-Bahá',
      'taf': 'Tablet to August Forel',
      'tdp': 'Tablets of the Divine Plan',
      'tn' : 'Traveller’s Narrative',
      'wt' : 'Will and Testament of ‘Abdu’l-Bahá',
      'swb': 'Selections from the Writings of the Báb',
      'esw': 'Epistle to the Son of the Wolf',
      'gdm': 'Gems of Divine Mysteries',
      'gwb': 'Gleanings from the Writings of Bahá’u’lláh',
      'hw' : 'Hidden Words',
      'ka' : 'Kitáb-i-Aqdas',
      'pm' : 'Prayers and Meditations of Bahá’u’lláh',
      'tu' : 'Tabernacle of Unity',
      'tb' : 'Tablets of Bahá’u’lláh',
      'ba' : 'Bahá’í Administration',
      'adj': 'Advent of Divine Justice',
      'cof': 'Citadel of Faith',
      'tdh': 'This Decisive Hour',
      'gpb': 'God Passes By',
      'pdc': 'Promised Day is Come',
      'wob': 'World Order of Bahá’u’lláh',
      'mf' : 'Memorials of the Faithful'
    };

  // processLibrary(library_path);

var promise = loadAccentsDictionary(accents_url);
console.log(promise);


  function loadAccentsDictionary(accents_url) {
    cli.info("Loading Dictionary...");
    var dictionary = [];
    var response = request({
      uri: accents_url,
      method: 'GET'
    })
    return response.then(function (res) {
      if (res.statusCode >= 300) {
        throw new Error('Server responded with status code ' + res.statusCode)
      } else {
        //return res.body.toString() //assuming tapes are strings and not binary data
        var data = JSON.parse(body);
        for (i = 0; i < data.rows.length; ++i) {
          dictionary.push(data.rows[i]['key']);
        }
        cli.info('Loaded dictionary, '+ dictionary.length + ' items');
        return dictionary
      }
    })
  }

  /*

  req(accents_url, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var data = JSON.parse(body);
      for (i = 0; i < data.rows.length; ++i) {
        dictionary.push(data.rows[i]['key']);
      }
      cli.info('Loaded dictionary, '+ dictionary.length + ' items');
      cli.info('Processing Library');
      processLibrary(library_path);
    } else {
      console.log("Error Response: " + error);
    }
  });

*/


  function libraryList(library_path) {
    var fileList = [];
    fs.readdir(library_path, function (err, files) {
      if (err) {
          throw err;
      }
      files.map(function (file) {
          return path.join(library_path, file);
      }).filter(function (file) {
          return (fs.statSync(file).isFile() && (path.extname(file)=='.html'));
      }).forEach(function (file) {
         // processBook(file);
          fileList.push(file);
      });
    });
    cli.info('!!!!!!! Done with Everything !!!!!!!!!');
  }

  function processBook(file) {
    jqd(file)
      .success(function() {
        cli.info('Processing: ' + file);
        var jq = this.$;
        var pars = jq('p');
        cli.info("Paragraphs count: "+pars.length);

        pars.each(function(index, par) {
          var id = jq(par).find('a').attr('name');
          var parInfo = '';
          if (id) parInfo = parse_id(id);
          if (parInfo) {
            parText = jq(par).text();
            parInfo.wordcount = parText.split(' ').length;

            report = {};
            diacritical.replaceText(parText, dictionary, 'showall', report);
            parInfo.report = report;

            pars.push(parInfo);

            //console.log(par_info);
          }
        });

        //cli.info('!!!!!!! Testing !!!!!!!!!');

      })
      .fail(function(errors) {
          cli.error(errors);
      })
      .run();

  }

  function parse_id(token){
    // like acronymn_language-section-p#
    // or acronymn_language-p#
    var data = token.split('-');
    if (data.slice(-1).pop().charAt(0)==='p' && (data.length>1 && data.length<4)) {
      var result = {};
      result.id = token;
      result.acronymn = data[0].split('_')[0];
      result.language = data[0].split('_')[1];
      result.title = BOOK_TITLES[result.acronymn];
      if (data.length === 2) {
        result.parnum = data[1].substring(1);
      } else if(data.length === 3) {
        result.parnum = data[1]+'.'+data[2].substring(1);
      }
    }
    return result;
  }




})();








