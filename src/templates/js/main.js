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
    // clear inputs
    $('input').val('');

    // set variables
    var selectedCircle = '';
    var sortBy = 0;

    // show all flash messages
    {% for message in get_flashed_messages() %}
      UTILS.showMessage("{{ message }}");
    {% endfor %}

    // bind create_bookmark button
    $('#create_bookmark').click(function(event) {
        if ($('#create_bookmark_uri').val() == '') {
          UTILS.showMessage('You must provide a bookmark URL.');
        } else {
          $.post("{{ url_for('create_bookmark') }}", {
              'uri':$('#create_bookmark_uri').val()
          }, function(response) {
              if (response.type == 'error') {
                UTILS.showMessage(response.message);
              } else if (response.type == 'success') {
                drawBookmarksFromServer(selectedCircle);
                $('#create_bookmark_uri').val('');
                if (selectedCircle != '') {
                  // add bookmark to selected circle
                  $.post("{{ url_for('add_bookmark_to_circle') }}", {
                      'bookmark_id':response.bookmark_id,
                      'circle_id':selectedCircle
                  }, function(response) {
                      if (response.type == 'error') {
                        UTILS.showMessage(response.message);
                      } else if (response.type == 'success') {
                        refreshElements();
                        $('#add_bookmark_id').val('');
                        $('#add_circle_id').val('');
                      }
                  });
                }
              }
          });
        }
    });

    // bind create_circle button
    $('#create_circle').click(function(event) {
        if ($('#create_circle_name').val() == '') {
          UTILS.showMessage('You must provide a circle name.');
        } else {
          $.post("{{ url_for('create_circle') }}", {
              'name':$('#create_circle_name').val()
          }, function(response) {
              if (response.type == 'error') {
                UTILS.showMessage(response.message);
              } else if (response.type == 'success') {
                refreshElements();
                $('#create_circle_name').val('');
              }
          });
        }
    });

  // bind add_bookmark_to_circle button
    $('#add_bookmark').click(function(event) {
    });

    // bind enter key on inputs
    $('#create_bookmark_uri').keydown(function(event) {
      if (event.keyCode == 13) {
        $('#create_bookmark').click();
      }
    });
    $('#create_circle_name').keydown(function(event) {
      if (event.keyCode == 13) {
        $('#create_circle').click();
      }
    });
    $('#add_bookmark_id').keydown(function(event) {
      if (event.keyCode == 13) {
        $('#add_bookmark').click();
      }
    });
    $('#add_circle_id').keydown(function(event) {
      if (event.keyCode == 13) {
        $('#add_bookmark').click();
      }
    });

    // TODO(mikemeko)
    var makeDraggable = function (element) {
      element.draggable({
        revert: true
      });
    }

    // makes a circle a droppable element such that if a bookmark is dropped
    // into it, it adds that bookmark to the circle
    var makeCircleDroppable = function (circle) {
      circle.droppable({
        drop: function (event, ui) {
          var bookmark_id = ui.draggable.attr('bookmark_id');
          if (typeof(bookmark_id) === "undefined") {
            // TODO(mikemeko): better error message
            UTILS.showMessage("You can't add that to a circle");
          } else {
            var circle_id = $(this).attr('circle_id');
            $.post("{{ url_for('add_bookmark_to_circle') }}", {
                'bookmark_id':bookmark_id,
                'circle_id':circle_id
            }, function(response) {
                if (response.type == 'error') {
                  UTILS.showMessage(response.message);
                } else if (response.type == 'success') {
                  refreshElements();
                  // TODO(mikemeko)
                  UTILS.showMessage("Bookmark successfully added to circle");
                }
            });
          }
          $(this).removeClass("highlight");
        },
        over: function (event, ui) {
          $(this).addClass("highlight");
        },
        out: function (event, ui) {
          $(this).removeClass("highlight");
        },
        tolerance: 'touch'
      });
    }

    // populates bookmark elements and attaches listeners
    // called
    // 1) when document ready initially
    // 2) after a user interaction that modifies the circles
    var drawCirclesFromServer = function() {
        $('#circles_container').html('');
        $.post("{{ url_for('get_circles') }}", function(data) {
            $.each(data.circles, function(idx, circle) {
                var div = $('<div/>');
                div.addClass("circle");
                div.attr('circle_id', circle.id);
                var span1 = $('<span/>');
                span1.attr('class', 'circle');
                span1.text(circle.name);
                span1.appendTo(div);
                span1.click(function() {
                  if (selectedCircle != circle.id) {
                    selectedCircle = circle.id;
                    $('.circle').each(function (idx, elt) {
                      $(elt).removeClass('selected');
                    });
                    span1.addClass('selected');
                  } else {
                    selectedCircle = '';
                    span1.removeClass('selected');
                  }
                  drawBookmarksFromServer(selectedCircle);
                });
                makeCircleDroppable(div);
                $('#circles_container').append(div);
            });
            // select the selected circle
            if (selectedCircle != '') {
              $('#' + selectedCircle).addClass('selected');
            }
        });
    };

    // populates circle elements and attaches listeners
    // called:
    // 1) when document ready initially
    // 2) when the selected circle changes
    // 3) when bookmarks are re-sorted
    // 4) after a user interaction that modifies bookmarks
    var drawBookmarksFromServer = function(circle_id) {
        $('#bookmarks_container').html('');
        $.post("{{ url_for('get_bookmarks') }}", {
                'circle_id':circle_id
            }, function(data) {
                $.each(data.bookmarks, function(idx, bookmark) {
                    var div = $('<div/>');
                    div.addClass('bookmark');
                    div.attr('bookmark_id', bookmark.id);
                    var a = $('<a/>');
                    a.attr('href', bookmark.url);
                    a.text(bookmark.url);
                    a.appendTo(div);
                    makeDraggable(div);
                    $('#bookmarks_container').append(div);
            });
        });
    };

    // refresh the bookmarks and circles
    var refreshElements = function() {
        drawBookmarksFromServer(selectedCircle);
        drawCirclesFromServer();
    };

    // make initial call to refreshElements
    refreshElements();


});
