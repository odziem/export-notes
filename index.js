const path = require('path');
const fs = require('fs').promises;

const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: path.join(__dirname, 'db', 'NotesV7.storedata'),
  },
  useNullAsDefault: true,
});

const query = `
  SELECT
    ZTITLE,
    ZHTMLSTRING,
    MAX(ZDATEEDITED) AS LASTEDITED
  FROM ZNOTE INNER JOIN ZNOTEBODY ON ZNOTE.ZBODY = ZNOTEBODY.Z_PK
  GROUP BY DATETIME(ZDATECREATED+978325200, 'unixepoch')
`;

// Unix and most systems store time in seconds from January 1, 1970.
// Instead, Apple stores time in seconds from January 1, 2001.
// 978307200 is the amount of seconds between these two dates.
// See: https://www.epochconverter.com/coredata
const appleTimeToUnixTime = appleTime => 978307200 + appleTime; 

const writeNotesToFiles = async () => {
  const results = await knex.raw(query);

  // Even though only one folder, recursive prevents error if already exists.
  await fs.mkdir('notes', { recursive: true });

  for (const result of results) {
    // Replace illegal / in OSX filenames with +, and add extension.
    const fileName = result.ZTITLE.replace(/\//g, '+') + '.html';
    const lastModified = appleTimeToUnixTime(result.LASTEDITED);

    let file;
    
    try {
      console.log(`Writing ${fileName}...`);

      // Open with mode for "writing".
      file = await fs.open(`notes/${fileName}`, 'w');
  
      // Write html to the file.
      await file.writeFile(result.ZHTMLSTRING);
  
      // Update modified and access date, i.e. "mac" times.
      // Arguments are Numbers so no reason to pass a Date().
      await file.utimes(lastModified, lastModified);
    } catch (err) {
      console.error(err);
    } finally {
      if (file) {
        await file.close();
      }
    }
  }
};

writeNotesToFiles()
  .catch(console.error)
  .finally(() => process.exit(0));