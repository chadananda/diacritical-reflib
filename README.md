## Diacritical.refilb
#### An ad-hoc script to generate a report of term spelling errors from reference library books

This is a node.js project so you'll have to have node.js installed and then run "node install" to pull in dependencies.

From the command line this should be complete:


```
 git clone git@github.com:chadananda/diacritical-reflib.git
 cd diacritical-reflib
 npm install
 node app.js
```

The script will run in the shell and should take 5-10 minutes to process all the paragraphs in the library. Go have a sandwhich. When the script is done, it will generate a new report html file in the same directory. Open in your browser for a full paragraph-by-paragraph summary.  