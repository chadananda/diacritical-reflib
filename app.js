#!/usr/bin/env node

var cli = require('cli'),
    Q = require('q'),
    path = require('path'),
    qfs = require('q-io/fs'),
    qhttp = require('q-io/http'),
    cheerio = require('cheerio'),
    num = require('numeral'),
    Diacritical = require('diacritical');



var reportData = {},
    diacritical = new Diacritical();


// load in additional cli capabilities
cli.enable('help', 'version', 'status');
var options = cli.parse();


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
    'cf' : 'Citadel of Faith',
    'tdh': 'This Decisive Hour',
    'gpb': 'God Passes By',
    'pdc': 'Promised Day is Come',
    'wob': 'World Order of Bahá’u’lláh',
    'mf' : 'Memorials of the Faithful',
    'wta': 'Will and Testament of ‘Abdu’l-Bahá'
  };
var accents_url = 'http://diacritics.iriscouch.com/accents/_design/terms_list/_view/terms_list',
    library_path = 'library';

qFetchAccentsDictionary(accents_url) // fetches dictionary from accents_url
  .then(function(dictionary) {
    return qFileList(library_path).then(function(files) {
      return qAnalizeLibary(files, dictionary, reportData); // returns list of promises
    });
  })
  .then(function(data) {
    return qAggregateReport(reportData);
  })
  .done(function(data) {
    cli.info('Done: ');
    //console.log(reportData);
  });



function qFetchAccentsDictionary(accents_url) {
  cli.info("1.  Loading Dictionary...");
  dictionary = [];
  var accents = {
    url: accents_url,
    encoding: 'utf-8',
    method: 'GET'
  };
  return qhttp.request(accents).then(function (res) {
    if (res.status >= 300) {
      throw new Error('2.  Server responded with error status code ' + res.statusCode);
    } else {
      return res.body.read().then(function(data){
        data = JSON.parse(data);
        for (i = 0; i < data.rows.length; ++i) dictionary.push(data.rows[i]['key']);
        cli.info('2.  Loaded dictionary, '+ num(dictionary.length).format('0,0') + ' items');
        return dictionary;
      });
    }
  });
}

function qFileList(libary_path) {
  cli.info('3.  Reading dir: '+ library_path);
  return qfs.list(library_path).then(function(files) {
    fileList = [];
    cli.info('3.1 Located '+ files.length + ' files.');
    for (var i = 0; i < files.length; i++) {
      if (path.extname(files[i])=='.html') {
        fileList.push(path.join(library_path, files[i]));
      }
    }
    return fileList;
  });
}


function qAnalizeLibary(files, dictionary) {
  reportData = {};
  cli.info('4   Analyzing '+ files.length + ' files.');
  var promiseList = [];
  for (var i = 0; i < files.length; i++) {
    if (path.extname(files[i])=='.html') {
      var file = files[i];
      cli.info('4.1 Adding new promise for file: '+ file);
      promiseList.push(
        qfs.read(file).then(function(data){
          var file_name = file;
          processBook(file_name, data, dictionary);
        })
      );
    }
  }
  return Q.all(promiseList);
}


function processBook(filename, fileData, dictionary) {
  cli.info('5.  Processing: '+ filename );
  $ = cheerio.load(fileData);
  var pars = $('p');
  cli.info("5.1 Paragraphs count: "+ num(pars.length).format('0,0'));
  for (var i = 0; i < pars.length; i++) {
    var par = pars[i];
    var id = $(par).find('a').attr('name');
    var parInfo = '';
    var report = {};
    if (id) parInfo = parseId(id);
    if (parInfo && parInfo.parnum) {
      parText = $(par).text();
      parInfo.wordcount = parText.split(' ').length;
      diacritical.replaceText(parText, dictionary, 'showall', report);
      parInfo.report = report;
      if (report.unknownTotal || report.correctedTotal) {
        if (typeof reportData[parInfo.title] === "undefined") reportData[parInfo.title] = {};
        reportData[parInfo.title][parInfo.parnum] = parInfo;
        cli.info('5.2  '+parInfo.title+' '+parInfo.parnum+'  ('+ (report.correctedTotal + report.unknownTotal) + ' issues)');
      }
    }
  }
}

function qAggregateReport(reportData) {
  var filename='', title ='', prevTitle ='', summary = '';
  var correctedTotal = 0, unknownTotal = 0;
  var unknowns = {}, hasUnknowns = false;
  var html='',
      html_header ='<html> \n  <head><meta charset="utf-8"> \n\n '+
       '<link rel="stylesheet" href="http://yui.yahooapis.com/pure/0.5.0/base-min.css">\n'+
       '<style>\n  body{margin: 1em;}\n  h3{margin-left:1em;}\n  ol li{line-height:1.5em}'+
       '\n  ol.unknowns li{line-height:1.5em;}\n  p,ol{margin-left:3em; padding-left:0;}\n  .unkn i{color: #333;}  '+
       '\n  ol.unknowns{columns: 100px 4; -webkit-columns: 100px 4; -moz-columns: 100px 4;}' +
       '\n</style>\n</head>\n\n' +
       '<body> \n\n ';
  var report = {};
  var date = new Date().toISOString().split(/T/)[0];
  filename = 'report_'+date+'.html';
  for(title in reportData) {
    if (title != prevTitle) html += '<br><h2>'+title+'</h2>';
    prevTitle = title;
    for (var parnum in reportData[title]) {
      report = reportData[title][parnum].report;
      correctedTotal += report.correctedTotal;
      hasUnknowns = ((typeof report['unknowns'] != "undefined") && (report.unknowns.length>0));
      if (hasUnknowns) {
        for (var i=0; i<report.unknowns.length; i++) {
          unknowns[report.unknowns[i]] = 1;
        }
      }
      if (report.correctedTotal || hasUnknowns) {
        html += '\n\n<h3> In paragraph '+parnum+' </h3>';
        if (report.correctedTotal) html += formatReplacements(report.replacements);
        if (hasUnknowns) {
          html += '\n<p class="unkn"> <i>Possibly incorrect:</i><b> ' +report.unknowns.join('</b>, <b>') +'</b></p>';
        }
      }
    }
  }
  summary = '\n\n<h2> Total corrections '+ num(correctedTotal).format('0,0') + ', unknowns: '+ Object.keys(unknowns).length +'</h2>';
  summary += '\n\n<h3>  Unknowns: </h3> <ol class="unknowns">\n  <li>' + Object.keys(unknowns).join('\n  <li>') + '\n</ol><hr>';

  html = html_header + summary + html;

  cli.info('6.  Saving report to: '+ filename);
  return qfs.write(filename, html);
}

function formatReplacements(replacements) {
  var item='', html='', list = [];
  var phrases = [
    'should be spelled',
    'should be',
    'should problably be',
    'probably should be',
    'is probably meant to be',
    'is probably rendered',
    'is probably better spelled',
    'would more likely be spelled',
    'most likely should be spelled',
    'would be better rendered',
    'would be more correctly spelled',
    'is supposed to be spelled',
    'should be rendered',
    'should be transliterated as',
    'is more correctly spelled',
    'should be rendered',
    'is more properly transliterated as'
  ];
  for(item in replacements) list.push('<b>' +item + '</b> '+ phrases[Math.floor(Math.random() * phrases.length)] +' <b>' + replacements[item] +'</b>');
  if (list.length>1) html = '\n<ol class="repl">\n  <li>' + list.join("\n  <li>") + '\n</ol>';
   else html = '\n<p class="repl">' + list[0] + '</p>';
  return html;
}

function parseId(token){
  // like acronymn_language-section-p#  or  acronymn_language-p#
  var result = false,
      data = token.split('-');
  if (data.slice(-1).pop().charAt(0)==='p' && (data.length>1 && data.length<5)) {
    if (typeof BOOK_TITLES[data[0].split('_')[0]] === 'undefined') {
      cli.error('No book tile found for acronymn: '+ data[0].split('_')[0]);
    } else {
      var parnum;
      if (data.length === 2) parnum = data[1].substring(1);
      else if (data.length === 3) parnum = data[1]+'.'+data[2].substring(1);
      else if (data.length === 4) parnum = data[1]+'.'+data[2]+'.'+data[3].substring(1);

      return {
        'id': token,
        'acronymn': data[0].split('_')[0],
        'language': data[0].split('_')[1],
        'title': BOOK_TITLES[data[0].split('_')[0]],
        'parnum': parnum
      };
    }
  }
  return result;
}













