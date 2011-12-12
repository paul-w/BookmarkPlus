/**
 * Authors:
 * Michael Mekonnen (mikemeko@mit.edu)
 * Paul Woods (pwoods@mit.edu)
 * Justin Venezuela (jven@mit.edu)
 * JavaScript for main page.
 */

/*
At any given point, this code only knows about:
1)  All circles
2)  Which circle is selected
3)  Only the bookmarks for the selected circle
4)  How the bookmarks from the selected are being sorted

When the document is first ready:
0 ) get/draw circles + bookmarks initially from
On user interaction:
1)  call function on server to modify circles + bookmarks
2)  if function was modifying, get circles + bookmarks from server and immediately redraw

sorting just re-queries the db with a different sorting parameter
*/

$(document).ready(function() {

  /* Constants */

  var NUM_SUGGESTIONS = 3;
  var ENTER_KEY_CODE = 13;
  var DRAG_REVERT_DURATION = 100;

  var ASC_TEXT = ['<', '>']

  /* Variables */

  var selectedCircle = '';
  var sortBookmarksDivs = []
  var sortBookmarksBy = "{{ bookmark_sort_key }}";
  // 1 indicaets ascending, -1 descending
  var bAscending = "{{ bookmark_sort_order }}";

  /* Add missing elements to page */

  // sorting options
  b_options_div = $('#bookmark_sort_options')
  {% for option in bookmark_sort_options %}
    var div = $('<div/>');
    div.text("{{ option }}");
    div.addClass('sort');
    div.click(function() {
      text =  $(this).text();
      $.each(sortBookmarksDivs, function(index, sortBookmarkDiv) {
        sortBookmarkDiv.removeClass('selected_sort');
      });
      $(this).addClass('selected_sort');
      if (text ===  sortBookmarksBy) {
        bAscending = -bAscending;
        ascDiv.text(ASC_TEXT[(parseInt(bAscending)+1)/2]);

      }
      else {
        bAscending = 1;
        sortBookmarksBy =  text
        ascDiv.text(ASC_TEXT[(parseInt(bAscending)+1)/2]);
      }
      drawBookmarksFromServer(selectedCircle);
    });
    b_options_div.append(div);
    sortBookmarksDivs.push(div);
  {% endfor %}

    var ascDiv = $('<div/>');
    ascDiv.text(ASC_TEXT[(parseInt(bAscending)+1)/2]);
    ascDiv.addClass('sort');
    ascDiv.addClass('selected_sort');
    b_options_div.append(ascDiv);


  /*
    Ajax calls
    Each of these methods should make the respective change on the page
  */

  // create a new bookmark, and add it to the given circle, if any
  // call onSuccess with bookmarkID if successful
  var createBookmark = function (bookmarkURI, circleID, onSuccess) {
    $.post("{{ url_for('create_bookmark') }}", {
      'uri':bookmarkURI
    }, function (response) {
      if (response.type == 'error') {
        UTILS.showMessage(response.message);
      } else if (response.type == 'success') {
        UTILS.showMessage('Bookmark successfully created.');
        $('#create_bookmark_uri').val('');
        if (circleID !== '') {
          addBookmarkToCircle(response.bookmark_id, circleID, function (bookmarkID, circleID) {});
        } else {
          drawBookmarksFromServer(selectedCircle);
        }
        onSuccess(response.bookmark_id);
      }
    });
  }

  // delete a bookmark
  var deleteBookmark = function (bookmarkID) {
    $.post("{{ url_for('delete_bookmark') }}", {
      'bookmark_id': bookmarkID
    }, function (response) {
      if (response.type == 'error') {
        UTILS.showMessage(response.message);
      } else if (response.type == 'success') {
        UTILS.showMessage("Bookmark successfully deleted.");
        $('div[bookmark_id=' + bookmarkID + ']').remove();
        drawBookmarksFromServer(selectedCircle);
        drawSuggestionsFromServer();
      }
    });
  }

  // create a new circle and call on success, call onSuccess with
  // the id of the new circle as argument
  var createCircle = function (circleName, onSuccess) {
    $.post("{{ url_for('create_circle') }}", {
      'name':circleName
    }, function(response) {
      if (response.type == 'error') {
        UTILS.showMessage(response.message);
      } else if (response.type == 'success') {
        UTILS.showMessage('Circle successfully created.');
        $('#create_circle_name').val('');
        drawCirclesFromServer();
        onSuccess(response.circle_id);
      }
    });
  }

  // delete a circle
  var deleteCircle = function (circleID) {
    $.post("{{ url_for('delete_circle') }}", {
      'circle_id': circleID
    }, function (response) {
      if (response.type === 'error') {
        UTILS.showMessage(response.message);
      } else if (response.type == 'success') {
        UTILS.showMessage('Circle successfully deleted.');
        if (selectedCircle === circleID) {
          selectedCircle = '';
          drawBookmarksFromServer();
        }
        drawCirclesFromServer();
      }
    });
  }

  // edit the name of a circle and call onSucces if name change succeeds
  var editCircle = function (name, newName, onSuccess) {
    $.post("{{ url_for('edit_circle') }}", {
      'name':name,
      'new_name':newName
    }, function (response) {
      if (response.type === 'error') {
        UTILS.showMessage(response.message);
      } else if (response.type === 'success') {
        UTILS.showMessage('Circle name successfully changed.');
        onSuccess();
      }
    });
  }

  // add a bookmark to a circle and call onSuccess with the
  // bookmarkID and circleID as parameters
  var addBookmarkToCircle = function (bookmarkID, circleID, onSuccess) {
    $.post("{{ url_for('add_bookmark_to_circle') }}", {
      'bookmark_id':bookmarkID,
      'circle_id':circleID
    }, function (response) {
      if (response.type == 'error') {
        UTILS.showMessage(response.message);
      } else if (response.type == 'success') {
        UTILS.showMessage('Bookmark successfully added to circle.');
        if (selectedCircle !== '') {
          // this is for the case where we add a suggestion to a circle
          drawBookmarksFromServer(selectedCircle);
        }
        onSuccess(bookmarkID, circleID);
      }
    });
  }

  // remove a bookmark from a circle
  var removeBookmarkFromCircle = function (bookmarkID, circleID) {
    $.post("{{ url_for('remove_bookmark_from_circle') }}", {
        'bookmark_id':bookmarkID,
        'circle_id':circleID
    }, function (response) {
        if (response.type == 'error') {
          UTILS.showMessage(response.message);
        } else if (response.type == 'success') {
          UTILS.showMessage('Bookmark successfully removed from circle.');
        }
    });
  }

  // if the bookmark is in the circle, do |inCircle|, otherwise do |notInCircle|
  var bookmarkInCircle = function (bookmarkID, circleID, inCircle, notInCircle) {
        $.post("{{ url_for('is_bookmark_in_circle') }}", {
          bookmark_id:bookmarkID,
          circle_id:circleID
        }, function (response) {
          if (response.bookmark_in_circle) {
            inCircle();
          } else {
            notInCircle();
          }
        });
  }

  // get all the bookmarks (for the respective circle if given) and
  // call |applyToBookmark| on each
  var getBookmarks = function (circleID, applyToBookmark) {
    $.post("{{ url_for('get_bookmarks') }}", {
      'circle_id':circleID,
      'sort_by':sortBookmarksBy,
      'ascending':bAscending
    }, function (response) {
      $.each(response.bookmarks, function (index, bookmark) {
        applyToBookmark(bookmark);
      });
    });
  }

  // get all the circles and call |applyToCircle| on each
  var getCircles = function (applyToCircle) {
    $.post("{{ url_for('get_circles') }}", {
    }, function (response) {
      $.each(response.circles, function (index, circle) {
        applyToCircle(circle);
      });
    });
  }

  // get all the suggestions and call |applyToSuggestion| on each
  var getSuggestions = function (applyToSuggestion) {
    $.post("{{ url_for('get_suggestions') }}", {
      'num_sugg':NUM_SUGGESTIONS,
    }, function (response) {
      $.each(response.suggestions, function(index, suggestion) {
        applyToSuggestion(suggestion);
      });
    });
  }

  // a bookmark was just clicked, recored data
  var recordClick = function (bookmarkID) {
    $.post("{{ url_for('click') }}", {
      'bookmark_id':bookmarkID
    });
  }

  //
  var getTitleForUrl = function (url, onSuccess) {
    $.post("{{ url_for('title_for_url') }}", {
      'url':url
    }, function (response) {
      onSuccess(response.title);
    });
  }

  /* Bind page elements to Ajax calls */

  // bind sort option toggler
  // TODO(mikemeko, pauL): do we still need this?


  // bind create bookmark input box
  $('#create_bookmark_uri').keydown(function(event) {
    if (event.keyCode == ENTER_KEY_CODE) {
      var bookmarkURI = $('#create_bookmark_uri').val();
      if (bookmarkURI == '') {
        UTILS.showMessage('Please provide a bookmark URI.');
      } else {
        createBookmark(bookmarkURI, selectedCircle, function (bookmarkID) {});
      }
    }
  });

  // bind create circle input box
  $('#create_circle_name').keydown(function(event) {
    if (event.keyCode == ENTER_KEY_CODE) {
      var circleName = $('#create_circle_name').val();
      if (circleName == '') {
        UTILS.showMessage('Please provide a circle name.');
      } else {
        createCircle(circleName, function (circleID) {});
      }
    }
  });

  // make |bookmark| draggable so that it can be added to circle or deleted
  var makeBookmarkDraggable = function (bookmark) {
    bookmark.draggable({
      start: function (event, ui) {
        ui.helper.addClass("cursor");
        bookmark.addClass("faded");
        $("#add_bookmark").hide();
        $("#delete_bookmark").show();
        var bookmarkID = bookmark.attr('bookmark_id');
        getCircles(function (circle) {
          var circleDiv = $('div[circle_id=' + circle.id + ']');
          bookmarkInCircle(bookmarkID, circle.id,
            function () {
              circleDiv.addClass('closed');
            }, function () {
              circleDiv.addClass('open');
            });
        });
      },
      stop: function (event, ui) {
        ui.helper.removeClass("cursor");
        bookmark.removeClass("faded");
        $("#add_bookmark").show();
        $("#delete_bookmark").hide();
        getCircles(function (circle) {
          var circleDiv = $('div[circle_id=' + circle.id + ']');
          circleDiv.removeClass('open');
          circleDiv.removeClass('closed');
        });
      },
      revert: 'invalid',
      revertDuration: DRAG_REVERT_DURATION,
      helper: 'clone',
      containment: 'window',
    });
  }

  // make |suggestion| draggable so that it can be added as a bookmark
  var makeSuggestionDraggable = function (suggestion) {
    suggestion.draggable({
      start: function (event, ui) {
        ui.helper.addClass("cursor");
        suggestion.addClass('faded');
      },
      stop: function (event, ui) {
        ui.helper.removeClass("cursor");
        suggestion.removeClass('faded');
      },
      revert: 'invalid',
      revertDuration: DRAG_REVERT_DURATION,
      helper: 'clone',
    });
  }

  // make |circle| draggable so that it can be deleted
  var makeCircleDraggable = function (circle) {
    circle.draggable({
      start: function (event, ui) {
        ui.helper.addClass("cursor");
        circle.addClass("faded");
        $("#add_circle").hide();
        $("#delete_circle").show();
      },
      stop: function (event, ui) {
        ui.helper.removeClass("cursor");
        circle.removeClass("faded");
        $("#add_circle").show();
        $("#delete_circle").hide();
      },
      revert: 'invalid',
      revertDuration: DRAG_REVERT_DURATION,
      helper: 'clone',
      containment: 'parent'
    });
  }

  // makes a circle a droppable element so that if a bookmark is dropped
  // into it, that bookmark is added to it
  var makeCircleDroppable = function (circle) {
    var circleID = circle.attr('circle_id');
    circle.droppable({
      drop: function (event, ui) {
        if (ui.draggable.hasClass('suggestion')) {
          createBookmark(ui.draggable.attr('uri'), circleID, function (bookmarkID) {});
          ui.draggable.remove();
        } else {
          var bookmarkID = ui.draggable.attr('bookmark_id');
          bookmarkInCircle(bookmarkID, circleID,
            function () {
              removeBookmarkFromCircle(bookmarkID, circleID);
            },
            function () {
              addBookmarkToCircle(bookmarkID, circleID, function (bookmarkID, circleID) {});
            });
        }
        circle.removeClass('add_bookmark');
        circle.removeClass('remove_bookmark');
      },
      over: function (event, ui) {
        var bookmarkID = ui.draggable.attr('bookmark_id');
        bookmarkInCircle(bookmarkID, circleID,
          function () {
            circle.addClass('remove_bookmark');
          }, function () {
            circle.addClass('add_bookmark');
          });
      },
      out: function (event, ui) {
        circle.removeClass('add_bookmark');
        circle.removeClass('remove_bookmark');
      },
      accept: '.bookmark',
      tolerance: 'intersect'
    });
  }

  // if a bookmark is dropped in the delete_bookmark div, delete it
  $('#delete_bookmark').droppable({
    drop: function (event, ui) {
      if (ui.draggable.hasClass('bookmark')) {
        var bookmarkID = ui.draggable.attr('bookmark_id');
        deleteBookmark(bookmarkID);
      } else {
        UTILS.showMessage("That is not a bookmark.");
      }
    },
    over: function (event, ui) {
      ui.helper.addClass("faded");
    },
    out: function (event, ui) {
      ui.helper.removeClass("faded");
    },
    tolerance: 'intersect'
  });

  // if a circle is dropped in the delete_circle div, delete it
  $('#delete_circle').droppable({
    drop: function (event, ui) {
      if (ui.draggable.hasClass('circle')) {
        var circleID = ui.draggable.attr('circle_id');
        deleteCircle(circleID);
      } else {
        UTILS.showMessage("That is not a circle.");
      }
    },
    over: function (event, ui) {
      ui.helper.addClass("faded");
    },
    out: function (event, ui) {
      ui.helper.removeClass("faded");
    },
    tolerance: 'intersect'
  });

  // if a bookmark is dragged to the add_circle div, create
  // a new circle containing that bookmark
  $('#add_circle').droppable({
    drop: function (event, ui) {
      var date = new Date();
      // TODO(mikemeko): date object doesn't work correctly
      var circleName = date.getFullYear() + '/' + date.getMonth() + '/' + date.getDay();
      if (ui.draggable.hasClass('suggestion')) {
        createCircle(circleName, function (circleID) {
          createBookmark(ui.draggable.attr('uri'), circleID, function (bookmarkID) {
            $('div[circle_id="' + circleID + '"]').find('input').val('');
            $('div[circle_id="' + circleID + '"]').find('input').select();
          });
        });
      } else {
        var bookmarkID = ui.draggable.attr('bookmark_id');
        createCircle(circleName, function (circleID) {
          addBookmarkToCircle(bookmarkID, circleID, function (bookmarkID, circleID) {
            $('div[circle_id="' + circleID + '"]').find('input').val('');
            $('div[circle_id="' + circleID + '"]').find('input').select();
          });
        });
      }
      $('#add_circle').find('input').show();
      $('#add_circle').removeClass('new_circle');
      $('#add_circle').addClass('unique');
    },
    over: function (event, ui) {
      $('#add_circle').find('input').hide();
      $('#add_circle').removeClass('unique');
      $('#add_circle').addClass('new_circle');
    },
    out: function (event, ui) {
      $('#add_circle').find('input').show();
      $('#add_circle').removeClass('new_circle');
      $('#add_circle').addClass('unique');
    },
    tolerance: 'intersect',
    accept: '.bookmark'
  });

  $('#bookmarks_container').droppable({
    drop: function (event, ui) {
      createBookmark(ui.draggable.attr('uri'), selectedCircle, function (bookmarkID) {});
      ui.draggable.remove();
    },
    over: function (event, ui) {
      ui.helper.addClass('accept_suggestion');
    },
    out: function (event, ui) {
      ui.helper.removeClass('accept_suggestion');
    },
    tolerance: 'intersect',
    accept: '.suggestion'
  });

  // binds listeners to |circle| to make it behave like a circle
  var bindCircleEventListeners = function (circle) {
    var circle_id = circle.attr('circle_id');
    circle.hover(function() {
      circle.addClass('circle_hover');
    }, function() {
      circle.removeClass('circle_hover');
    });
    circle.click(function() {
      if (selectedCircle != circle_id) {
        selectedCircle = circle_id;
        $('.circle').each(function (index, circle_) {
          $(circle_).removeClass('selected');
        });
        circle.addClass('selected');
      } else {
        selectedCircle = '';
        circle.removeClass('selected');
      }
      drawBookmarksFromServer(selectedCircle);
    });
    makeCircleDroppable(circle);
    makeCircleDraggable(circle);
  }

  // clears the circle container, leaving only the circle adder / deleter
  var clearCircleContainer = function () {
    $.each($('#inner_circles_container').children(), function (index, circle) {
      if ($(circle).attr('id') !== 'add_circle' &&
          $(circle).attr('id') !== 'delete_circle') {
        $(circle).remove();
      }
    });
  }

  // clears the bookmark container, leaving only the bookmark adder / deleter
  var clearBookmarkContainer = function () {
    $.each($('#bookmarks_container').children(), function (index, bookmark) {
      if ($(bookmark).attr('id') !== 'add_bookmark' &&
          $(bookmark).attr('id') !== 'delete_bookmark') {
        $(bookmark).remove();
      }
    });
  }

  // clears the suggestions container
  var clearSuggestionContainer = function () {
    $.each($('#suggestions_container').children(), function (index, suggestion) {
      $(suggestion).remove();
    });
  }

  // returns a URI containing the favicon for |URI|
  // |URI| should contain '://'
  var faviconFor = function (URI) {
    var schemeSeparator = URI.indexOf('://');
    var hierPart = URI.substring(schemeSeparator + '://'.length);
    return 'http://www.getfavicon.org/?url=' + hierPart;
  }

  // makes and returns a div that contains the given uri, or the
  // respective title. This helper method is used in
  // |drawBookmark| and |drawSuggestion|
  var drawUrlContainer = function (URI) {
    var container = $('<div/>');
    container.attr('uri', URI);
    container.addClass('bookmark');
    var favicon = $('<img/>');
    favicon.attr('src', faviconFor(URI));
    favicon.addClass('favicon');
    var faviconContainer = $('<div/>');
    faviconContainer.append(favicon);
    faviconContainer.addClass('favicon_container');
    container.append(faviconContainer);
    var uriLink = $('<a/>');
    uriLink.addClass('bookmark_text');
    uriLink.text(URI);
    getTitleForUrl(URI, function (title) {
      uriLink.text(title);
    });
    var textContainer = $('<div/>');
    textContainer.append(uriLink);
    textContainer.addClass('bookmark_text_container');
    container.append(textContainer);
    container.hover(function() {
      container.addClass('bookmark_hover');
    }, function() {
      container.removeClass('bookmark_hover');
    });
    return container;
  }

  // draw a bookmark div and bind the appropriate listeners
  var drawBookmark = function (bookmarkID, bookmarkURI) {
    bookmarkContainer = drawUrlContainer(bookmarkURI);
    bookmarkContainer.attr('bookmark_id', bookmarkID);
    bookmarkContainer.click(function () {
      window.open(bookmarkURI);
      recordClick(bookmarkID);
    });
    makeBookmarkDraggable(bookmarkContainer);
    $('#bookmarks_container').append(bookmarkContainer);
  }

  // draw a suggestion bookmark and bind the appropriate listeners
  var drawSuggestion = function (suggestionURI) {
    suggestionContainer = drawUrlContainer(suggestionURI);
    suggestionContainer.addClass('suggestion');
    suggestionContainer.click(function () {
      window.open(suggestionURL);
    });
    makeSuggestionDraggable(suggestionContainer);
    $('#suggestions_container').append(suggestionContainer);
  }

  // draw a circle div and bind the appropriate listeners
  var drawCircle = function (circleID, circleName) {
    var div = $('<div/>');
    div.addClass('circle');
    div.attr('circle_id', circleID);
    var input = $('<input type="text"/>');
    input.addClass('circle_name');
    input.attr('maxlength', '{{ max_circle_name_length }}');
    input.val(circleName);
    div.append(input);
    input.keydown(function (event) {
      if (event.keyCode == ENTER_KEY_CODE) {
        var newCircleName = input.val();
        if (newCircleName === '') {
          UTILS.showMessage('Please enter a new circle name.');
        } else if (newCircleName === circleName) {
          UTILS.showMessage('Please enter a different circle name.');
        } else {
          editCircle(circleName, newCircleName, function () {
            circleName = newCircleName;
            input.val(newCircleName);
            input.blur();
          });
        }
        input.val(circleName);
      }
      event.stopPropagation();
    });
    input.click(function (event) {
      event.stopPropagation();
    });
    input.blur(function (event) {
      input.val(circleName);
    });
    bindCircleEventListeners(div);
    $('#inner_circles_container').append(div);
  }

  // populates bookmark elements and attaches listeners
  // called
  // 1) when document ready initially
  // 2) after a user interaction that modifies the circles
  var drawCirclesFromServer = function () {
    clearCircleContainer();
    getCircles(function (circle) {
      drawCircle(circle.id, circle.name);
    });
    // if a circle is selected, show that it is selected
    if (selectedCircle !== '') {
      var circleDiv = $("div[circle_id='" + selectedCircle + "']");
      circleDiv.addClass('selected');
    }
  };

  // populates circle elements and attaches listeners
  // called:
  // 1) when document ready initially
  // 2) when the selected circle changes
  // 3) when bookmarks are re-sorted
  // 4) after a user interaction that modifies bookmarks
  var drawBookmarksFromServer = function (circleID) {
    clearBookmarkContainer();
    getBookmarks(circleID, function (bookmark) {
      drawBookmark(bookmark.id, bookmark.url);
    });
  };

  // populates suggestion bookmarks
  var drawSuggestionsFromServer = function() {
    clearSuggestionContainer();
    getSuggestions(function (suggestion) {
      drawSuggestion(suggestion.url);
    });
  };


  /* Initialization */

  // display bookmarks, circles, and suggestions
  drawBookmarksFromServer(selectedCircle);
  drawCirclesFromServer();
  drawSuggestionsFromServer();

  // clear all inputs
  $('input').val('');

  // delete divs should only be visible when the respective delete
  // object is being dragged
  $('#delete_bookmark').hide();
  $('#delete_circle').hide();

  // show all flash messages
  {% for message in get_flashed_messages() %}
    UTILS.showMessage("{{ message }}");
  {% endfor %}

});
