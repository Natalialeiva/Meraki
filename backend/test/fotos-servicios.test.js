const {test}=require('node:test'),assert=require('node:assert/strict'),sharp=require('sharp'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {convertir,crearAlmacen,LIMITE}=require('../fotos-servicios');
test('Fotografías: decodifica raster, elimina metadatos y rechaza contenido engañoso',async()=>{
 const png=await sharp({create:{width:24,height:20,channels:3,background:'#bb88aa'}}).png().toBuffer();
 const salida=await convertir(png,'image/png','imagen.png');assert.equal((await sharp(salida).metadata()).format,'webp');
 for(const [datos,mime,nombre]of [[Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),'image/png','foto.png'],[Buffer.from('script'),'image/jpeg','archivo.jpg'],[png,'image/jpeg','foto.jpg'],[png,'image/svg+xml','foto.svg'],[png,'image/png','archivo.exe'],[png,'image/png','../foto.png'],[png.subarray(0,20),'image/png','cortada.png']])await assert.rejects(convertir(datos,mime,nombre),e=>e.http===415);
 await assert.rejects(convertir(Buffer.alloc(LIMITE+1),'image/png','grande.png'),e=>e.http===413);
 await assert.rejects(convertir(Buffer.alloc(0),'image/png','vacia.png'),e=>e.http===400);
});
test('Almacén escribe archivos propios y rechaza rutas arbitrarias',async()=>{
 const carpeta=await fs.mkdtemp(path.join(os.tmpdir(),'meraki-fotos-unit-')),a=crearAlmacen(carpeta),n=require('crypto').randomUUID()+'.webp';
 try{await a.guardar(n,Buffer.from('fixture'));assert.equal((await a.leer(n)).toString(),'fixture');await assert.rejects(a.guardar(n,Buffer.from('otro')),e=>e.code==='EEXIST');await assert.rejects(a.leer('../privado'));await a.borrar(n);await a.borrar(n);}
 finally{for(const f of await fs.readdir(carpeta)){assert.equal(f,n);await fs.unlink(path.join(carpeta,f));}await fs.rmdir(carpeta);}
});
