var width = 700,
  height = 380;

var projection = d3.geoMercator()
    .center([-76.3, 40.6])
    .scale(6000);

var path = d3.geoPath()
  .projection(projection);

var svg = d3.select("#map").append("svg")
  .attr("width", width)
  .attr("height", height);

function renderDistrict(number, voteInfo) {
  d3.json("topojson/pa-" + number + ".topojson", function(error, district) {
    if (error) {
      throw error;
    }

    var party = "democrat";
    if (voteInfo.republican && (!voteInfo.democrat || voteInfo.democrat.count < voteInfo.republican.count)) {
      party = "republican";
    }
    var contested = (!voteInfo.republican || !voteInfo.democrat) ? "uncontested" : "contested";

    var feature = topojson.feature(district, district.objects['pa-' + number]);

    var bounds = path.bounds(feature);
    var x_bounds = Math.abs(bounds[1][0] - bounds[0][0]);
    var y_bounds = Math.abs(bounds[1][1] - bounds[0][1]);
    var scale = Math.max(6000, 900000 / (Math.sqrt(x_bounds * y_bounds)));

    var mega_center = projection.invert(path.centroid(feature));
    mega_center[0] += 1.3 / (scale / 8000);
    mega_center[1] -= 0.4 / (scale / 8000);
    
    var mega_me = d3.geoMercator().scale(scale).center(mega_center);
    var is_mega = false;

    svg.insert("path")
      .datum(feature)
      .attr("class", ["district", party, contested].join(" "))
      .attr("d", path)
      .on("click", function() {
        var border = d3.select(this);
        if (border.classed('dull') && !is_mega) {
          return;
        }
        
        is_mega = !is_mega;
        d3.selectAll(".district").classed("dull", is_mega);
        border
          .classed("mega", is_mega)
          .attr("d", is_mega ? path.projection(mega_me) : path.projection(projection));
        if (is_mega) {
          border.raise();
        }
/*
        d3.selectAll(".district").style("fill", "#fc3c2f");
        d3.select(this).style("fill", "#00f");
*/
      });
  });
}

var votesByDistrict = {};

d3.json("vote-totals.json", function(err, districts) {
  if (err) {
    throw err;
  }
  votesByDistrict = districts;
  
  // generate the map
  for (var d = 1; d <= 18; d++) {
    var district = districts[d + ""];
    renderDistrict(d, district);
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
    .rangeRound([height, 0]);
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
