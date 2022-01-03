# PFlix

This was created to watch my own DVD movies from away from home travelling, without having to carry a DVD Player around.

DO NOT MAKE THE SITE PUBLICLY ACCESSIBLE as you will be in potential violation of copyright laws.

All content is ripped to MP4 and placed in folders, named specifically.

# Requirements

TMDB API : https://www.themoviedb.org/

Create an account, go to Account -> Settings -> API on the left menu

Modify the config.json and enter your API you receive from the site. This is used for pulling poster data

In addition to that, go change the username/password you wish to use to log into the site. It creates a basic cookie
in browser.

You may also change the operating port should you need to as well in the config.json.

# Setup

First, install the node modules: npm install 

Then modify the config.json file to meet your needs.

## Library Paths

The current version only supports Movies and TV Series.
Each category has a number associated with it, and when you add a folder, you must enter the type of folder it is.
Do not add a trailing slash.

Example:
{
    "root":"C:/Path/To/Movies",
    "category":0
}

After adding your folders, you can initialize a scan by visiting the /manager/scan endpoint ( Default: http://localhost:8000/manager/scan )

This will generate a videos.json database file of all mp4 files it found according to the settings you have entered in the folders config.json section.

The next step is to load the page by logging in and visiting the library manager.

(Default: http://localhost:8000/librarymanager.html)

This will ask you to login to the site using the username / password you specified in the config.json.

# Adding Posters

In all cases, when you select a poster, it will highlight with a green border indicating which one you have selected.

Movies will rename the 'title' value in the videos.json file, but TV Series will not. See "File Name Formatting" section.

## TV Series

Easiest way, is to select a single episode in the series, then on the right check the "Series" and type the name of the series in the input box.

Click the find poster, and select the poster for the series, then the save button.

Currently it sets the same poster for all episodes in the series, and not by season. (No individual season posters for now)

## Movies

Select the movie title on the left, and click Find Poster. If it has no results, try doing a manual search for the title of the movie.

Example of an error:
    Movie Title: JFK Directors Cut
    No Results, so custom search: JFK

Select the correct poster and click save.

# File Name Formatting

For movies, it doesn't care about the folder and filename. The file name is by default the 'title' minus the extension.

For TV Series, you must put them in the following folder structure:

/Series/Season #/E## - Title.mp4

Example: /The Simpsons/Season 1/E01 - Simpsons Roasting on an Open Fire.mp4

The Series and Season folders are use to identify series / seasons within the database.

The filename of the episode is there for simplicity and wrapping text when titles are longer than the display room.
This is why there are no E##_TITLE_NAME_HERE.mp4 filenames, because the underscores disallow wrapping of text when it is wider than the poster width on the library page.