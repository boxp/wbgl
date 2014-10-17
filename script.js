var c;
var q = new qtnIV();
var qt = q.identity(q.create());


window.onload = function () {

  // canvasとクォータニオンをグローバル変数とする
  c = document.getElementById('canvas');

  // input rangeエレメント
  var eLines     = document.getElementById('lines');
	var eLineStrip = document.getElementById('line_strip');
	var eLineLoop  = document.getElementById('line_loop');
	var ePointSize = document.getElementById('point_size');

  // マウスムーブイベントリスナ
  function mouseMove(e) {
    var cw = c.width;
    var ch = c.height;
    var wh = 1 / Math.sqrt(cw * cw + ch * ch);
    var x = e.clientX - c.offsetLeft - cw * 0.5;
    var y = e.clientY - c.offsetTop - ch * 0.5;
    var sq = Math.sqrt(x * x + y * y);
    var r = sq * 2.0 * Math.PI * wh;
    if (sq != 1) {
      sq = 1 / sq;
      x *= sq;
      y *= sq;
    }
    q.rotate(r, [y, x, 0.0], qt);
  }

  c.width = 512;
  c.height = 512;

  c.addEventListener('mousemove', mouseMove, true);

  var gl = c.getContext('webgl', {stencil: true}) || c.getContext('experimental-webgl', {stencil: true});

  var v_shader = create_shader('vs');
  var f_shader = create_shader('fs');

  var prg = create_program(v_shader, f_shader);

  // attributeLocationを配列に登録
  var attLocation = new Array();
  attLocation[0] = gl.getAttribLocation(prg, 'position');
  attLocation[1] = gl.getAttribLocation(prg, 'normal');
  attLocation[2] = gl.getAttribLocation(prg, 'color');
  attLocation[3] = gl.getAttribLocation(prg, 'textureCoord');

  // attributeの要素数を配列に格納
  var attStride = new Array();
  attStride[0] = 3;
  attStride[1] = 3;
  attStride[2] = 4;
  attStride[3] = 2;

  // キューブデータ
	var cubeData      = cube(2.0, [1.0, 1.0, 1.0, 1.0]);
	var cPosition     = create_vbo(cubeData.p);
	var cNormal       = create_vbo(cubeData.n);
	var cColor        = create_vbo(cubeData.c);
	var cTextureCoord = create_vbo(cubeData.t);
	var cVBOList      = [cPosition, cNormal, cColor, cTextureCoord];
	var cIndex        = create_ibo(cubeData.i);
	
	// アースデータ
	var earthData     = sphere(64, 64, 1.0, [1.0, 1.0, 1.0, 1.0]);
	var ePosition     = create_vbo(earthData.p);
	var eNormal       = create_vbo(earthData.n);
	var eColor        = create_vbo(earthData.c);
	var eTextureCoord = create_vbo(earthData.t);
	var eVBOList      = [ePosition, eNormal, eColor, eTextureCoord];
	var eIndex        = create_ibo(earthData.i);

  var m = new matIV();
  
  // 四元数の宣言と初期化
  var aQuaternion = q.identity(q.create());
  var bQuaternion = q.identity(q.create());
  var sQuaternion = q.identity(q.create());

  var mMatrix = m.identity(m.create());
  var vMatrix = m.identity(m.create());
  var pMatrix = m.identity(m.create());
  var tmpMatrix = m.identity(m.create());
  var mvpMatrix = m.identity(m.create());
  var invMatrix = m.identity(m.create());
  var qMatrix = m.identity(m.create());

  var uniLocation = new Array();
  uniLocation[0] = gl.getUniformLocation(prg, 'mMatrix');
  uniLocation[1] = gl.getUniformLocation(prg, 'mvpMatrix');
  uniLocation[2] = gl.getUniformLocation(prg, 'invMatrix');
  uniLocation[3] = gl.getUniformLocation(prg, 'lightDirection');
  uniLocation[4] = gl.getUniformLocation(prg, 'useLight');
  uniLocation[5] = gl.getUniformLocation(prg, 'texture');

  // 視点の向き
  var eyeDirection = [0.0, 0.0, 5.0];

  // カメラの座標
  var camPosition = [0.0, 0.0, 10.0];

  // カメラの上方向を表すベクトル
  var camUpDirection = [0.0, 1.0, 0.0];

  // 環境光
  var ambientColor = [0.1, 0.1, 0.1, 1.0];

  // 平行光源の向き
  var lightDirection = [1.0, 1.0, 1.0];

  // カウンタ
  var count = 0;

  // HSV to RGB
  function hsva(h, s, v, a){
    if(s > 1 || v > 1 || a > 1){return;}
    var th = h % 360;
    var i = Math.floor(th / 60);
    var f = th / 60 - i;
    var m = v * (1 - s);
    var n = v * (1 - s * f);
    var k = v * (1 - s * (1 - f));
    var color = new Array();
    if(!s > 0 && !s < 0){
        color.push(v, v, v, a); 
    } else {
        var r = new Array(v, n, m, m, k, v);
        var g = new Array(k, v, v, n, m, m);
        var b = new Array(m, m, k, v, v, n);
        color.push(r[i], g[i], b[i], a);
    }
    return color;
  } 

  // パラメーターの設定
  gl.enable(gl.DEPTH_TEST);
	gl.depthFunc(gl.LEQUAL);
  
  var texture0 = null;
  var texture1 = null;

  // テクスチャの読み込み
  create_texture('texture0.png', 0);
  create_texture('texture1.png', 1);
  gl.activeTexture(gl.TEXTURE0);

  var fBufferWidth = 512;
  var fBufferHeight = 512;
  var fBuffer = create_framebuffer(fBufferWidth, fBufferHeight);

  // 回常ループ
  (function () {

    count++;
		var rad = (count % 360) * Math.PI / 180;
		var rad2 = (count % 720) * Math.PI / 360;

    gl.bindFramebuffer(gl.FRAMEBUFFER, fBuffer.f);

    // canvasの初期化
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clearDepth(1.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


    set_attribute(eVBOList, attLocation, attStride);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eIndex);

    var lightDirection = [-1.0, 2.0, 1.0];
		
		// ビュー行列の生成
		m.lookAt([0.0, 0.0, 5.0], [0, 0, 0], [0, 1, 0], vMatrix);
		m.perspective(45, fBufferWidth / fBufferHeight, 0.1, 100, pMatrix);
		m.multiply(pMatrix, vMatrix, tmpMatrix);
		
		// テクスチャの設定
		gl.bindTexture(gl.TEXTURE_2D, texture1);
    m.identity(mMatrix);
    m.scale(mMatrix, [50.0, 50.0, 50.0], mMatrix);
    m.multiply(tmpMatrix, mMatrix, mvpMatrix);
    m.inverse(mMatrix, invMatrix);
    gl.uniformMatrix4fv(uniLocation[0], false, mMatrix);
    gl.uniformMatrix4fv(uniLocation[1], false, mvpMatrix);
    gl.uniformMatrix4fv(uniLocation[2], false, invMatrix);
    gl.uniform3fv(uniLocation[3], lightDirection);
    gl.uniform1i(uniLocation[4], false);
    gl.uniform1i(uniLocation[5], 0);
    gl.drawElements(gl.TRIANGLES, earthData.i.length, gl.UNSIGNED_SHORT, 0);

    gl.bindTexture(gl.TEXTURE_2D, texture0);
		m.identity(mMatrix);
		m.rotate(mMatrix, rad, [0, 1, 0], mMatrix);
		m.multiply(tmpMatrix, mMatrix, mvpMatrix);
		m.inverse(mMatrix, invMatrix);
		gl.uniformMatrix4fv(uniLocation[0], false, mMatrix);
		gl.uniformMatrix4fv(uniLocation[1], false, mvpMatrix);
		gl.uniformMatrix4fv(uniLocation[2], false, invMatrix);
		gl.uniform1i(uniLocation[4], true);
		gl.drawElements(gl.TRIANGLES, earthData.i.length, gl.UNSIGNED_SHORT, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // canvasの初期化
    gl.clearColor(0.0, 0.7, 0.7, 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    set_attribute(cVBOList, attLocation, attStride);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cIndex);

    gl.bindTexture(gl.TEXTURE_2D, fBuffer.t);

    lightDirection = [-1.0, 0.0, 0.0];

    m.lookAt([0.0, 0.0, 5.0], [0, 0, 0], [0, 1, 0], vMatrix);
		m.perspective(45, c.width / c.height, 0.1, 100, pMatrix);
		m.multiply(pMatrix, vMatrix, tmpMatrix);
		
		m.identity(mMatrix);
		m.rotate(mMatrix, rad2, [1, 1, 0], mMatrix);
		m.multiply(tmpMatrix, mMatrix, mvpMatrix);
		m.inverse(mMatrix, invMatrix);
		gl.uniformMatrix4fv(uniLocation[0], false, mMatrix);
		gl.uniformMatrix4fv(uniLocation[1], false, mvpMatrix);
		gl.uniformMatrix4fv(uniLocation[2], false, invMatrix);
		gl.drawElements(gl.TRIANGLES, cubeData.i.length, gl.UNSIGNED_SHORT, 0);

    // コンテキストの再描画
    gl.flush();

    // ループのための再帰呼び出し
    setTimeout(arguments.callee, 1000 / 60);

  })();

  // IBOを生成する関数
  function create_ibo(data) {
    // バッファオブジェクトの生成
    var ibo = gl.createBuffer();

    // バッファをバインドする
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);

    // バッファにデータをセット
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Int16Array(data), gl.STATIC_DRAW);

    // バッファのバインドを無効化
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return ibo;

  }

  // モデル行列から変換行列を完成させレンダリングする
  function render_model(mMatrix) {
    m.multiply(tmpMatrix, mMatrix, mvpMatrix);
    gl.uniformMatrix4fv(uniLocation[0], false, mvpMatrix);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  function set_attribute(vbo, attL, attS) {
    // 引数として受け取った配列を処理する
    for (var i in vbo) {
      // バッファをバインド
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo[i]);

      // attributeLocationを有効にする
      gl.enableVertexAttribArray(attL[i]);

      // attributeLocationを通知し登録する
      gl.vertexAttribPointer(attL[i], attS[i], gl.FLOAT, false, 0, 0);

    }
  }

  function create_shader(id) {
    var shader;

    var scriptElement = document.getElementById(id);

    if(!scriptElement){return;};

    switch(scriptElement.type) {
      case "x-shader/x-vertex":
        shader = gl.createShader(gl.VERTEX_SHADER);
        break;

      case "x-shader/x-fragment":
        shader = gl.createShader(gl.FRAGMENT_SHADER);
        break;

      default:
        return;
    }

    // 生成されたシェーダーにソースを割り当てる
    gl.shaderSource(shader, scriptElement.text);

    gl.compileShader(shader);

    if(gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      return shader;
    } else {
      alert(gl.getShaderInfoLog(shader));
    }
  }

  function create_program(vs, fs) {
    var program = gl.createProgram();

    // プログラムオブジェクトにシェーダーを割り当てる
    gl.attachShader(program,vs);
    gl.attachShader(program,fs);

    gl.linkProgram(program);

    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.useProgram(program);
      return program;
    } else {
      alert(gl.getProgramInfoLog(program));
    }
  }

  function create_vbo(data) {
    var vbo = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return vbo;
  }

  // テクスチャーを読み込む
	function create_texture(source, number){
		// イメージオブジェクトを生成
		var img = new Image();
		
		// イメージが読み込まれた時の処理
		img.onload = function(){
			var tex = gl.createTexture();
			
			gl.bindTexture(gl.TEXTURE_2D, tex);
			
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
			
			gl.generateMipmap(gl.TEXTURE_2D);
			
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
			
			switch(number){
				case 0:
					texture0 = tex;
					break;
				case 1:
					texture1 = tex;
					break;
				default:
					break;
			}
			
			gl.bindTexture(gl.TEXTURE_2D, null);
		};
		
		img.src = source;
	}

  function blend_type(prm) {
    switch(prm) {
      //透過処理
      case 0:
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        break;
      //加算合成
      case 1:
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        break;
      default:
        break;
    }
  }

	function create_framebuffer(width, height){
		var frameBuffer = gl.createFramebuffer();
		
		gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
		
		var depthRenderBuffer = gl.createRenderbuffer();
		gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderBuffer);
		
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
		
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRenderBuffer);
		
		var fTexture = gl.createTexture();
		
		gl.bindTexture(gl.TEXTURE_2D, fTexture);
		
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fTexture, 0);
		
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		
		return {f : frameBuffer, d : depthRenderBuffer, t : fTexture};
	}
}
