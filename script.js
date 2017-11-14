var isExpanded = false;
var upArrow = 'https://s3.amazonaws.com/drone-deploy-plugins/templates/login-example-imgs/arrow-up.svg';
var downArrow = 'https://s3.amazonaws.com/drone-deploy-plugins/templates/login-example-imgs/arrow-down.svg';
var expandArrow = document.querySelector('.expand-arrow');
var expandBody = document.querySelector('.expand-section');
var expandRow = document.querySelector('.expand-row');
var pdfquery = document.querySelector('.button-pdf');

expandRow.addEventListener('click', function(){
  isExpanded = !isExpanded
  if (isExpanded){
    expandArrow.src = upArrow;
    expandBody.style.display = 'block';
  } else{
    expandArrow.src = downArrow;
    expandBody.style.display = 'none';
  }
});


// Grab the tiles from the plan(current area being viewed)
grabTiles(plan){
  const tiles = dronedeployApi.Tiles.get({ planId: plan.id, layerName: 'ortho', zoom: 18 });
  return Promise.all([tiles, plan]);
};


// function gets formats tiles into the correct form.
function getTilesFromGeometry(geometry, template, zoom){
  function long2tile(lon,zoom) {
    return (Math.floor((lon+180)/360*Math.pow(2,zoom)));
  }
  function lat2tile(lat,zoom) {
    return (Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom)));
  }
  function replaceInTemplate(point){
    return template.replace('{z}', point.z)
      .replace('{x}', point.x)
      .replace('{y}', point.y);
  }

  var allLat = geometry.map(function(point){
    return point.lat;
  });
  var allLng = geometry.map(function(point){
    return point.lng;
  });
  var minLat = Math.min.apply(null, allLat);
  var maxLat = Math.max.apply(null, allLat);
  var minLng = Math.min.apply(null, allLng);
  var maxLng = Math.max.apply(null, allLng);
  var top_tile    = lat2tile(maxLat, zoom); // eg.lat2tile(34.422, 9);
  var left_tile   = long2tile(minLng, zoom);
  var bottom_tile = lat2tile(minLat, zoom);
  var right_tile  = long2tile(maxLng, zoom);

  var tiles = [];
  for (var y = top_tile; y < bottom_tile + 1; y++) {
    for (var x = left_tile; x < right_tile + 1; x++) {
      tiles.push(replaceInTemplate({x, y, z: zoom}))
    }
  }

  return tiles;
}


// Two functions that convert the tiles into blob objects that allow the data to be sent via URL
UrlBlob(response) {
  Promise.all(response.map(imageObject => imageObject.blob()))
};

blobURL(blobs){
  Promise.all(blobs.map(blob => URL.createObjectURL(blob)))
};
//


  // Proxy server
  cors([tiles, plan]){
    const allTiles = getTilesFromGeometry(plan.geometry, tiles.template, 18);
    const corsTiles = allTiles.map(url => fetch(`https://drone-deploy-proxy-server.herokuapp.com/${url}`));
    return Promise.all(corsTiles);
  };



  // gets all the images and then sticks them together to form PDF
  convertImage(objectUrls){
    toPicture(doc, urls){
      const topMargin = 5;
      const imageSize = 50;
      const maxY = (imageSize * 4) + topMargin;
      let currentY = 50;
      let currentX = topMargin;

      return urls.map((url) => {
        const y = currentY;
        const x = currentX;

        currentX += imageSize;
        if (currentX >= maxY) {
          currentY += imageSize;
          currentX = topMargin;
        }

        return new Promise((resolve, reject) => {
          const image = new Image();
          image.src = url;

          image.onload = () => {
            doc.addImage(image, 'PNG', x, y, imageSize, imageSize);
            resolve();
          };
        });
      });
    };
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text(75, 20, 'Drone Deploy PDF Image');

    const tileImages = createPicture(doc, objectUrls);

    Promise.all(tileImages)
      .then((success) => {
        doc.save('droneDeployMap.pdf');
      });
  };




  // Eventlistener that creates the pdf on click.
  pdfquery.addEventListener('click', function(){
    dronedeployApi.Plans.getCurrentlyViewed()
    .then(grabTiles)
      .then(cors)
        .then(urlBlob)
          .then(blobURL)
            .then(convertImage)
          });
  });
