
// Checks if the URL passed has the same origin than Jappix itself

function isSameOrigin(testUrl) {

  var ajaxRequest = jQuery.ajax({
    url: testUrl,
    async: false
  });

  return !(ajaxRequest.state()=="rejected" && ajaxRequest.status === 0);
}