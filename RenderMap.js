// create a standard D3 SVG map
var width = 700,
  height = 380;

var projection = d3.geoMercator()
    .center([-76.3, 40.6]);

// deliver a smaller size to smaller screens
// for some reason I am giving all small screens the same scale
// works best on my phone as landscape
var testWidth = d3.select('#map').style('width').replace('px', '') * 1;
var origScale = 6000;
if (testWidth < 700) {
  width = testWidth;
  height = Math.ceil(380 * testWidth / 700);
  projection.center([-73.4, 39.31]);
  origScale = 3660;
}
projection.scale(origScale);

var path = d3.geoPath()
  .projection(projection);

// Map 1: the slider map
var svg = d3.select("#map").append("svg")
  .attr("width", width)
  .attr("height", height);

// Map 2: the clickable districts map
var svg2 = d3.select("#map2").append("svg")
  .attr("width", width)
  .attr("height", height);

// global variables once loaded
var votesByDistrict = {};
var loadedGeoByDistrict = {};

// state-wide popular vote
var basePercent = 0;

// keep track of featured district on Map 2
var mega_me = {};
var mega_district = null;

// on Map 2, you can click a district to see data and see it enlarged
// on smaller screens, there's a dropdown which triggers the same function
// quickSwitch was making you click-out of a district before opening a new one; I disabled it
function clickDistrict(number, quickSwitch) {
  if (!number) {
    // chose a bad option
    return;
  }
  quickSwitch = true;
  
  // load current info about this district
  var voteInfo = votesByDistrict[number + ''];
  var border = d3.select('#map2 .d-' + number);
  var is_mega = border.classed('mega');
  if (!quickSwitch && border.classed('dull') && !is_mega) {
    // without quickSwitch option, you need to click out of the active district first
    return;
  }
  
  // switch mega status
  is_mega = !is_mega;

  if (is_mega) {
    if (mega_district) {
      // make the previous mega-district small again
      clickDistrict(mega_district);
    }
    mega_district = number;
    
    // to make this district appear over the top of the others, call raise()
    d3.select('#map2 .d-' + number).raise();
    d3.select('#districtnum').text(number);
    
    // create a row of vote stats for the Republican candidate
    var repRow = d3.select('#stats .republican').html('');
    if (voteInfo.republican) {
      // repVoteResult stores a winning checkmark if the candidate wins; empty string if not
      // this allows if(repVoteResult){} to test if this candidate won
      var repVoteResult = (!voteInfo.democrat || voteInfo.democrat.count < voteInfo.republican.count) ? '&check;' : '';
      repRow.append('td').text(voteInfo.republican.name);
      repRow.append('td').text(voteInfo.republican.count.toLocaleString());
      repRow.append('td').html(repVoteResult);
              
      if (!voteInfo.democrat) {
        // uncontested election, not using wasted vote stats here
        d3.selectAll('#wasted .republican, #wasted .democrat').text('Uncontested');
      } else if (repVoteResult) {
        // Republican win - show overvote
        var overvote = voteInfo.republican.count;
        overvote -= Math.round((voteInfo.democrat.count + overvote) / 2);
        d3.select('#wasted .republican').text(overvote.toLocaleString() + ' due to >50% vote');
      } else {
        // Democrat win - show election loss
        d3.select('#wasted .republican').text(voteInfo.republican.count.toLocaleString() + ' due to loss');
      }
    } else {
      // show uncontested
      repRow.append('td').attr('colspan', '3').text('Uncontested');
    }

    // create a row of vote stats for the Democratic candidate
    var demRow = d3.select('#stats .democrat').html('');
    if (voteInfo.democrat) {
      // demVoteResult stores a winning checkmark if the candidate wins; empty string if not
      // this allows if(demVoteResult){} to test if this candidate won
      var demVoteResult = (!voteInfo.republican || voteInfo.democrat.count > voteInfo.republican.count) ? '&check;' : '';
      demRow.append('td').text(voteInfo.democrat.name);
      demRow.append('td').text(voteInfo.democrat.count.toLocaleString());
      demRow.append('td').html(demVoteResult);
      
      if (!voteInfo.republican) {
        // uncontested
        d3.selectAll('#wasted .republican, #wasted .democrat').text('Uncontested');
      } else if (demVoteResult) {
        // dem won - calculate overvote
        var overvote = voteInfo.democrat.count;
        overvote -= Math.round((voteInfo.republican.count + overvote) / 2);
        d3.select('#wasted .democrat').text(overvote.toLocaleString() + ' due to overvote');
      } else {
        // dem lost
        d3.select('#wasted .democrat').text(voteInfo.democrat.count.toLocaleString() + ' due to loss');
      }
    } else {
      // show uncontested
      demRow.append('td').attr('colspan', '3').text('Uncontested');
    }
  } else {
    // this district is no longer mini
    mega_district = null;
  }
  // show/reveal stats
  d3.select('#stats').classed('hide', !is_mega);
  
  // make all non-selected districts look faded
  d3.selectAll("#map2 .district").classed("dull", function() {
    if (!d3.select(this).classed('d-' + number)) {
      return is_mega;
    }
  });

  // this timeout helped me show the animation
  setTimeout(function() {
    border.classed("mega", is_mega)
      .attr("d", is_mega ? path.projection(mega_me[number]) : path.projection(projection));
  }, 100);
}

// mobile-only dropdown to select districts in Map2
d3.select('#zoomer').on('change', function() {
  clickDistrict(d3.select(this).property('value') * 1, true);
});

function renderDistrict(number, shift) {
  var voteInfo = votesByDistrict[number + ""];
  
  // by default, we are measuring the actual election and not a shifted one
  if (!shift) {
    shift = 0;
  }
    
  var colorDistrict = function() {
    // calculate vote shift
    var shiftedDemVote,
      shiftedRepVote,
      totalVote = (voteInfo.democrat || { count: 0 }).count + (voteInfo.republican || { count: 0 }).count;
    if (voteInfo.democrat && voteInfo.republican) {
      shiftedDemVote = voteInfo.democrat.count + (shift * totalVote / 100);
      shiftedRepVote = voteInfo.republican.count - (shift * totalVote / 100);
    }
    
    // determine who won
    var party = "democrat";    
    if (voteInfo.republican && (!voteInfo.democrat || shiftedDemVote < shiftedRepVote)) {
      party = "republican";
    }
    
    // Map1 updates to match any real or simulated election
    d3.select('#map .d-' + number)
      .classed('democrat', false)
      .classed('republican', false)
      .classed(party, true);
    
    // Map2 is only set to numbers based on actual election
    if (!shift) {
      d3.select('#map2 .d-' + number).classed(party, true); 
    }
  };
  
  if (loadedGeoByDistrict[number + ""]) {
    colorDistrict();
  } else {
    d3.json("topojson/pa-" + number + ".topojson", function(error, district) {
      if (error) {
        throw error;
      }
      loadedGeoByDistrict[number + ""] = true;
      
      // notice if this district was contested
      var contested = (!voteInfo.republican || !voteInfo.democrat) ? "uncontested" : "contested";
      
      // convert topojson into svg
      var feature = topojson.feature(district, district.objects['pa-' + number]);
      
      // create a mega_me projection based on the size of this district
      // each district has different bounds but we want them to look equally cool when big
      var bounds = path.bounds(feature);
      var x_bounds = Math.abs(bounds[1][0] - bounds[0][0]);
      var y_bounds = Math.abs(bounds[1][1] - bounds[0][1]);

      // make bounds a little bigger on mobile
      if (testWidth < 700) {
        x_bounds *= 1.5;
        y_bounds *= 1.5;
      }
      
      var scale = Math.max(6000, 900000 / (Math.sqrt(x_bounds * y_bounds)));
      var mega_center = projection.invert(path.centroid(feature));
      mega_center[0] += 1.3 / (scale / 8000);
      mega_center[1] -= 0.4 / (scale / 8000);
      mega_me[number] = d3.geoMercator().scale(scale).center(mega_center);
      
      // add district to Map1
      // place district inside an svg <g> element to make walkway.js animation possible
      // add contested / uncontested class to make it toggle-able
      svg.append('g').attr("id", "d-" + number)
        .insert("path")
          .datum(feature)
          .attr("class", ["district", contested, "d-" + number].join(" "))
          .attr("d", path);
    
      // add district to Map2
      svg2.insert("path")
        .datum(feature)
        .attr("class", ["district", "d-" + number].join(" "))
        .attr("d", path)
        .on("click", function() {
          clickDistrict(number);
        });
    
      // color both districts now
      colorDistrict();
      
      // on mobile, don't try the fancy SVG animation :(
      if (testWidth > 700) {
        var ww = new Walkway({
          selector: '#d-' + number,
          duration: '3500'
        });
        ww.draw();
      }
    });
  }
}

d3.json("vote-totals.json", function(err, districts) {
  if (err) {
    throw err;
  }
  // globally store vote count
  votesByDistrict = districts;
  
  // generate the map
  for (var d = 1; d <= 18; d++) {
    renderDistrict(d);
  }

  var datapoints = [];
  
  // partisan symmetry: hold many elections with different vote shifts
  for (var revote = -14; revote < 16; revote += 2) {
    var republicanVote = 0,
    democratVote = 0,
    republicanSeats = 0,
    democratSeats = 0,
    republicanUncontested = 0,
    democratUncontested = 0,
    uncontested = '';
    
    for (var d = 1; d <= 18; d++) {
      var district = districts[d + ""];
      if (district.republican && district.democrat) {
        // shift votes in contested seats
        var districtTotal = district.republican.count + district.democrat.count;
        var localRep = district.republican.count - (districtTotal * revote / 100);
        var localDem = district.democrat.count + (districtTotal * revote / 100);
        republicanVote += localRep;
        democratVote += localDem;
        
        // who won the district in this simulation?
        if (localRep > localDem) {
          republicanSeats++;
        } else {
          democratSeats++;
        }
    
      // handle uncontested seats
      } else if (district.republican) {
        republicanUncontested++;
      } else {
        democratUncontested++;
      }
    }
    
    // calculate effectiveness of votes in this simulation
    var popPercentage = (democratVote / (republicanVote + democratVote) * 100);
    var seatPercentage = (democratSeats / (democratSeats + republicanSeats) * 100);
    
    // store datapoint for the graph later
    datapoints.push({
      percent: popPercentage,
      seats: seatPercentage
    });
    
    if (democratUncontested) {
      uncontested = ' + ' + democratUncontested + ' uncontested';
    }
    
    // add table of results
    var voteRow = d3.select('#results').append('tr');
    if (revote === 0) {
      // this is the actual 0-offset result

      // highlght the row, save basePercent
      voteRow.attr('class', 'highlight');
      basePercent = popPercentage;
      
      // if the user moves the slider, adjust based on this calculation
      d3.select("#mapshift")
        .property('disabled', false)
        .attr('min', popPercentage - 10)
        .property('value', popPercentage)
        .attr('max', popPercentage + 10)
        .on('change', function() {
          // re-color the districts based on user-specified shift
          var shift = d3.select(this).property('value') - basePercent;
          // (shift > 0 ? ('+' + shift.toFixed(1)) : shift.toFixed(1))
          d3.select('#mapshift-container .change').text((d3.select(this).property('value') * 1).toFixed(1) + '% (' + (shift > 0 ? ('+' + shift.toFixed(1)) : shift.toFixed(1)) + ')');
          for (var d = 1; d <= 18; d++) {
            renderDistrict(d, shift);
          }
        });
    }
    
    // finish rendering the row
    voteRow.append('td').text(popPercentage.toFixed(1) + '%');
    voteRow.append('td').text(democratSeats + ' (' + seatPercentage.toFixed(1) + '%)' + uncontested);
  }

  // generate the graph
  var g = d3.select('#graph');
  var width = g.style('width').replace('px', '') * 1 - 30;
  var height = width;
  var x = d3.scaleLinear()
    .rangeRound([0, width]);
  var y = d3.scaleLinear()
    .rangeRound([height - 10, 0]);
  var line = d3.line()
    .x(function(d) { return x(d.percent); })
    .y(function(d) { return y(d.seats); });  

  x.domain(d3.extent(datapoints, function(d) { return d.percent; }));
  y.domain(d3.extent(datapoints, function(d) { return d.seats; }));
  
  // graph x-axis
  g.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x))
    .append("text")
      .attr("fill", "#000")
      .attr("x", width)
      .attr("dy", -5)
      .attr("text-anchor", "end")
      .text("% Vote Won by Democrats");

  // graph y-axis
  g.append("g")
      .call(d3.axisLeft(y))
    .append("text")
      .attr("fill", "#000")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", "0.71em")
      .attr("text-anchor", "end")
      .text("% Seats Won by Democrats");
    
  // line
  g.append("path")
      .datum(datapoints)
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("stroke-width", 1.5)
      .attr("d", line);
});

// toggle uncontested districts visibility in Map1
d3.select("#contested").on("change", function() {
  d3.selectAll(".uncontested").classed("hide", !this.checked);
});
