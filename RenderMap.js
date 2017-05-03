var width = 700,
  height = 380;

var projection = d3.geoMercator()
    .center([-76.3, 40.6]);

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

var svg = d3.select("#map").append("svg")
  .attr("width", width)
  .attr("height", height);

var svg2 = d3.select("#map2").append("svg")
  .attr("width", width)
  .attr("height", height);

var votesByDistrict = {};
var loadedGeoByDistrict = {};
var mega_me = {};
var mega_district = null;
var basePercent = 0;

function clickDistrict(number, quickSwitch) {
  if (!number) {
    return;
  }
  
  var voteInfo = votesByDistrict[number + ''];
  quickSwitch = true;
  
  var border = d3.select('#map2 .d-' + number);
  var is_mega = border.classed('mega');
  if (!quickSwitch && border.classed('dull') && !is_mega) {
    return;
  }
  
  // switch mega status
  is_mega = !is_mega;

  if (is_mega) {
    if (mega_district) {
      // make the last one small first
      clickDistrict(mega_district);
    }
    mega_district = number;
    d3.select('#map2 .d-' + number).raise();

    //d3.select('#districtnum').text(number);

    var repRow = d3.select('#stats .republican').html('');
    if (voteInfo.republican) {
      var repVoteResult = (!voteInfo.democrat || voteInfo.democrat.count < voteInfo.republican.count) ? '&check;' : '';
      repRow.append('td').text(voteInfo.republican.name);
      repRow.append('td').text(voteInfo.republican.count.toLocaleString());
      repRow.append('td').html(repVoteResult);
              
      if (!voteInfo.democrat) {
        d3.selectAll('#wasted .republican, #wasted .democrat').text('Uncontested');
      } else if (repVoteResult) {
        var overvote = voteInfo.republican.count;
        overvote -= Math.round((voteInfo.democrat.count + overvote) / 2);
        d3.select('#wasted .republican').text(overvote.toLocaleString() + ' due to >50% vote');
      } else {
        d3.select('#wasted .republican').text(voteInfo.republican.count.toLocaleString() + ' due to loss');
      }
    } else {
      repRow.append('td').attr('colspan', '3').text('Uncontested');
    }
    
    var demRow = d3.select('#stats .democrat').html('');
    if (voteInfo.democrat) {
      var demVoteResult = (!voteInfo.republican || voteInfo.democrat.count > voteInfo.republican.count) ? '&check;' : '';
      demRow.append('td').text(voteInfo.democrat.name);
      demRow.append('td').text(voteInfo.democrat.count.toLocaleString());
      demRow.append('td').html(demVoteResult);
      
      if (!voteInfo.republican) {
        d3.selectAll('#wasted .republican, #wasted .democrat').text('Uncontested');
      } else if (demVoteResult) {
        var overvote = voteInfo.democrat.count;
        overvote -= Math.round((voteInfo.republican.count + overvote) / 2);
        d3.select('#wasted .democrat').text(overvote.toLocaleString() + ' due to overvote');
      } else {
        d3.select('#wasted .democrat').text(voteInfo.democrat.count.toLocaleString() + ' due to loss');
      }
    } else {
      demRow.append('td').attr('colspan', '3').text('Uncontested');
    }
  } else {
    mega_district = null;
  }
  d3.select('#stats').classed('hide', !is_mega);

  d3.selectAll("#map2 .district").classed("dull", function() {
    if (!d3.select(this).classed('d-' + number)) {
      return is_mega;
    }
  });

  setTimeout(function() {
    border.classed("mega", is_mega)
      .attr("d", is_mega ? path.projection(mega_me[number]) : path.projection(projection));
  }, 100);
}

// mobile dropdown
d3.select('#zoomer').on('change', function() {
  clickDistrict(d3.select(this).property('value') * 1, true);
});

function renderDistrict(number, shift) {
  var voteInfo = votesByDistrict[number + ""];
  if (!shift) {
      shift = 0;
  }
    
  var colorDistrict = function() {
    var shiftedDemVote,
      shiftedRepVote,
      totalVote = (voteInfo.democrat || { count: 0 }).count + (voteInfo.republican || { count: 0 }).count;
    if (voteInfo.democrat && voteInfo.republican) {
      shiftedDemVote = voteInfo.democrat.count + (shift * totalVote / 100);
      shiftedRepVote = voteInfo.republican.count - (shift * totalVote / 100);
    }

    var party = "democrat";    
    if (voteInfo.republican && (!voteInfo.democrat || shiftedDemVote < shiftedRepVote)) {
      party = "republican";
    }
    d3.select('#map .d-' + number)
      .classed('democrat', false)
      .classed('republican', false)
      .classed(party, true);

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

      var feature = topojson.feature(district, district.objects['pa-' + number]);
      var contested = (!voteInfo.republican || !voteInfo.democrat) ? "uncontested" : "contested";
      
      var bounds = path.bounds(feature);
      var x_bounds = Math.abs(bounds[1][0] - bounds[0][0]);
      var y_bounds = Math.abs(bounds[1][1] - bounds[0][1]);
      
      var scale = Math.max(6000, 900000 / (Math.sqrt(x_bounds * y_bounds)));
      var mega_center = projection.invert(path.centroid(feature));
      mega_center[0] += 1.3 / (scale / 8000);
      mega_center[1] -= 0.4 / (scale / 8000);
    
      mega_me[number] = d3.geoMercator().scale(scale).center(mega_center);

      svg.append('g').attr("id", "d-" + number)
        .insert("path")
          .datum(feature)
          .attr("class", ["district", contested, "d-" + number].join(" "))
          .attr("d", path);

      svg2.insert("path")
        .datum(feature)
        .attr("class", ["district", "d-" + number].join(" "))
        .attr("d", path)
        .on("click", function() {
          clickDistrict(number);
        });
      colorDistrict();
      
      var ww = new Walkway({
        selector: '#d-' + number,
        duration: '3500'
      });
      ww.draw();
    });
  }
}

d3.json("vote-totals.json", function(err, districts) {
  if (err) {
    throw err;
  }
  votesByDistrict = districts;
  
  // generate the map
  for (var d = 1; d <= 18; d++) {
    renderDistrict(d);
  }

  var datapoints = [];
  
  for (var revote = -14; revote < 16; revote += 2) {
    // votes in contested seats
    var republicanVote = 0,
    democratVote = 0,
    republicanSeats = 0,
    democratSeats = 0,
    republicanUncontested = 0,
    democratUncontested = 0;
    
    for (var d = 1; d <= 18; d++) {
      var district = districts[d + ""];
      if (district.republican && district.democrat) {
        var districtTotal = district.republican.count + district.democrat.count;
        var localRep = district.republican.count - (districtTotal * revote / 100);
        var localDem = district.democrat.count + (districtTotal * revote / 100);
        republicanVote += localRep;
        democratVote += localDem;
        
        if (localRep > localDem) {
          republicanSeats++;
        } else {
          democratSeats++;
        }
      } else if (district.republican) {
        republicanUncontested++;
      } else {
        democratUncontested++;
      }
    }
    
    var popPercentage = (democratVote / (republicanVote + democratVote) * 100);
    var seatPercentage = (democratSeats / (democratSeats + republicanSeats) * 100);
    datapoints.push({
      percent: popPercentage,
      seats: seatPercentage
    });
    
    if (democratUncontested) {
      var uncontested = ' + ' + democratUncontested + ' uncontested';
    }
    var voteRow = d3.select('#results').append('tr');
    if (revote === 0) {
      voteRow.attr('class', 'highlight');
      basePercent = popPercentage;
      d3.select("#mapshift")
        .property('disabled', false)
        .attr('min', popPercentage - 10)
        .property('value', popPercentage)
        .attr('max', popPercentage + 10)
        .on('change', function() {
          var shift = d3.select(this).property('value') - basePercent;
          // (shift > 0 ? ('+' + shift.toFixed(1)) : shift.toFixed(1))
          d3.select('#mapshift-container .change').text((d3.select(this).property('value') * 1).toFixed(1) + '% (' + (shift > 0 ? ('+' + shift.toFixed(1)) : shift.toFixed(1)) + ')');
          for (var d = 1; d <= 18; d++) {
            renderDistrict(d, shift);
          }
        });
    }
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
  
  g.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x))
    .append("text")
      .attr("fill", "#000")
      //.attr("transform", "rotate(-90)")
      .attr("x", width)
      .attr("dy", -5)
      .attr("text-anchor", "end")
      .text("% Vote Won by Democrats");

  g.append("g")
      .call(d3.axisLeft(y))
    .append("text")
      .attr("fill", "#000")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", "0.71em")
      .attr("text-anchor", "end")
      .text("% Seats Won by Democrats");
    
  g.append("path")
      .datum(datapoints)
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("stroke-width", 1.5)
      .attr("d", line);
});

d3.select("#contested").on("change", function() {
  d3.selectAll(".uncontested").classed("hide", !this.checked);
});
