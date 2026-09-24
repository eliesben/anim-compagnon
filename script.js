/* =========================================================
   ⚙️ CONFIGURATION
   ========================================================= */
const ACTIVITIES_API="https://anim-compagnon-api.eliesbendjedou30.workers.dev/activities";
const CATEGORIES_API="https://anim-compagnon-api.eliesbendjedou30.workers.dev/categories";
const PROJETS_API="https://anim-compagnon-api.eliesbendjedou30.workers.dev/projets";
const SEANCES_API="https://anim-compagnon-api.eliesbendjedou30.workers.dev/seances";
const AI_API="https://anim-compagnon-api.eliesbendjedou30.workers.dev/";
let activities = [];
let categories = [];
let resources = [];
let projets = [];
let seances = [];
let currentProjetId = null;
let previous = "home";
let currentCategory = "all";

/* =========================================================
   🧭 NAVIGATION
   ========================================================= */
function go(id){
  const current=document.querySelector(".view.active");
  if(current&&current.id!==id) previous=current.id;
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  const target=document.getElementById(id);if(!target)return;
  target.classList.add("active");
  const main=["home","categories","generator","help","account"].includes(id)?id:
    id==="detail"?(previous.startsWith("category")?"categories":previous):id==="activities"?"categories":
    ["publics","publicSubcategory","role","daily","toolbox","resources"].includes(id)?"categories":"home";
  document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.nav===main));
  window.scrollTo({top:0,behavior:"smooth"});
  if(id==="activities")renderActivities();
  if(id==="account")renderFavorites();
  if(id==="projets")loadProjets();
}
function back(){go(previous==="activities"?"activities":previous||"home")}

/* =========================================================
   🔎 RECHERCHE
   ========================================================= */
document.getElementById("searchInput").addEventListener("keydown",e=>{
  if(e.key!=="Enter")return;
  const q=e.target.value.trim().toLowerCase();if(!q)return;
  const found=activities.filter(a=>Object.values(a).join(" ").toLowerCase().includes(q));
  go("activities");renderActivityCards(found);
});
/* =========================================================
   🗂️ CATÉGORIES — BASEROW
   ========================================================= */

function categoryTarget(slug){
  const targets={
    activites:"activities",
    viequot:"daily",
    publics:"publics",
    role:"role",
    boite:"toolbox",
    ressources:"resources"
  };

  return targets[slug] || null;
}

function categoryClass(slug){
  const classes={
    activites:"tile-activites",
    viequot:"tile-vie-quotidienne",
    publics:"tile-publics",
    role:"tile-role",
    boite:"tile-boite-outils",
    ressources:"tile-ressources"
  };

  return classes[slug] || "";
}

function renderCategoryGrid(id,items){

  const el=document.getElementById(id);

  if(!el)return;

  if(!items.length){
    el.innerHTML=
      '<div class="empty"><strong>Aucune catégorie</strong>Aucune catégorie publiée pour le moment.</div>';
    return;
  }

  el.innerHTML=items.map(c=>{

    const target=categoryTarget(c.slug);
    const cls=categoryClass(c.slug);

    const action=target
      ? `onclick="go('${target}')"`
      : `onclick="toast('Cette catégorie sera bientôt disponible.')"`; 

    return `
      <button class="tile ${cls}" ${action}>
        <span>${esc(c.name)}</span>
      </button>
    `;

  }).join("");
}

async function loadCategories(){

  try{

    const res=await fetch(CATEGORIES_API,{cache:"no-store"});

    if(!res.ok)throw Error(res.status);

    const data=await res.json();

    const rows=Array.isArray(data)
      ? data
      : (data.results || []);

    categories=rows.map(r=>({

      id:r.id,

      name:String(r.NOM || "Catégorie sans nom"),

      slug:String(r.SLUG || "")
        .trim()
        .toLowerCase(),

      description:String(r.DESCRIPTION || ""),

      image:String(r.IMAGE || ""),

      order:Number(r.ORDRE) || 9999,

      home:String(r.ACCUEIL || "")
        .toLowerCase()==="oui",

      published:["oui","true","1","yes"]
        .includes(String(r.PUBLIÉ || "").toLowerCase())

    }))
    .filter(c=>c.published)
    .sort((a,b)=>a.order-b.order);

    renderCategoryGrid(
      "homeCategories",
      categories.filter(c=>c.home)
    );

    renderCategoryGrid(
      "allCategories",
      categories
    );

  }catch(e){

    console.error(e);

    const message=
      '<div class="empty"><strong>Catégories indisponibles</strong>Impossible de charger les catégories pour le moment.</div>';

    const home=document.getElementById("homeCategories");
    const all=document.getElementById("allCategories");

    if(home)home.innerHTML=message;
    if(all)all.innerHTML=message;
  }
}
/* =========================================================
   🎲 BASEROW
   ========================================================= */
function field(r,names){
  for(const n of names)if(r[n]!==undefined&&r[n]!==null&&String(r[n]).trim()!=="")return r[n];
  return "";
}
function mapActivity(r){
  const pub=field(r,["PUBLIÉ","PUBLIE","Publié","published"]);
  const p=String(pub).toLowerCase();
  return {
    id:r.id||Math.random(),name:String(field(r,["NOM DE L’ACTIVITÉ","NOM DE L'ACTIVITÉ","TITRES","Titre","name"])||"Activité sans titre"),
    category:String(field(r,["CATÉGORIE","CATEGORIE","Catégorie","Catégories","category"])||""),
    age:String(field(r,["ÂGE","Age","age"])||""),children:String(field(r,["NOMBRE D'ENFANTS","Nombre d'enfants"])||""),
    duration:String(field(r,["DURÉE","Durée","duration"])||""),prep:String(field(r,["TEMPS DE PRÉPARATION","Temps de préparation"])||""),
    location:String(field(r,["LIEU","Lieu","location"])||""),energy:String(field(r,["NIVEAU D'ÉNERGIE","Niveau d'énergie"])||""),
    material:String(field(r,["MATÉRIEL","Matériel"])||""),objectives:String(field(r,["OBJECTIFS PÉDAGOGIQUES","Objectifs pédagogiques"])||""),
    development:String(field(r,["DÉROULEMENT","Déroulement"])||""),variants:String(field(r,["VARIANTES","Variantes"])||""),
    vigilance:String(field(r,["POINTS DE VIGILANCE","Points de vigilance"])||""),
    image:String(field(r,["IMAGE","Image"])||""),
    published:pub===true||["true","1","oui","yes","vrai","publié","publie"].includes(p)
  };
}
async function loadActivities(){
  try{
    const res=await fetch(ACTIVITIES_API,{cache:"no-store"});if(!res.ok)throw Error(res.status);
    const data=await res.json(),rows=Array.isArray(data)?data:(data.results||data.activities||[]);
    activities=rows.map(mapActivity).filter(a=>a.published);
    renderActivities();
  }catch(e){
    console.error(e);document.getElementById("activityLoading").classList.add("hidden");
    document.getElementById("activityList").innerHTML='<div class="empty"><strong>Activités indisponibles</strong>Impossible de charger le contenu Baserow pour le moment.</div>';
  }
}
document.querySelectorAll("#catFilters .chip").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("#catFilters .chip").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");
  currentCategory=b.dataset.cat;renderActivities();
});
function renderActivities(){
  const list=document.getElementById("activityList");if(!list)return;
  document.getElementById("activityLoading").classList.add("hidden");
  let arr=currentCategory==="all"?activities:activities.filter(a=>a.category.toLowerCase()===currentCategory.toLowerCase());
  renderActivityCards(arr);
}
function renderActivityCards(arr){
  const list=document.getElementById("activityList");if(!arr.length){list.innerHTML='<div class="empty"><strong>Aucune activité trouvée</strong>Essaie un autre filtre ou utilise le générateur.</div>';return}
  window.rendered=arr;
  list.innerHTML=arr.map((a,i)=>`
    <button class="activity" onclick="openActivity(${i})">
      <div class="activity-info">
        <h2>${esc(a.name)}</h2>
        <div class="badges">${[a.age,a.duration,a.children?a.children+" enfants":""].filter(Boolean).map(x=>`<span class="badge">${esc(x)}</span>`).join("")}</div>
        ${a.objectives?`<p>${esc(short(a.objectives,110))}</p>`:""}
      </div>
    </button>`).join("");
}
function openActivity(i){
  const a=window.rendered[i];if(!a)return;
window.currentActivity=a;
  previous="activities";
  document.getElementById("detailTitle").textContent=a.name;
  document.getElementById("detailIntro").textContent=[a.age,a.duration,a.location].filter(Boolean).join(" • ");
  document.getElementById("detailBody").innerHTML=[
    ["Objectifs pédagogiques",a.objectives],["Matériel",a.material],["Déroulement",a.development],["Variantes",a.variants],["Points de vigilance",a.vigilance]
  ].filter(x=>x[1]).map(x=>`<h2>${esc(x[0])}</h2><p style="white-space:pre-line">${esc(x[1])}</p>`).join("")+
  `<div class="info"><strong>À retenir</strong><p>La fiche prépare l'activité. Le groupe, lui, est vivant : observe, adapte et accompagne.</p></div>
   <div style="height:12px"></div><button class="btn primary" onclick="favorite(window.currentActivity)">Ajouter aux favoris</button>`;
  go("detail");
}
/* =========================================================
   🧰 CONTENU
   ========================================================= */
function detail(title,category,intro){
  previous=category==="Public"?"publics":category==="Rôle de l’animateur"?"role":category==="Vie quotidienne"?"daily":"resources";
  document.getElementById("detailTitle").textContent=title;
  document.getElementById("detailIntro").textContent=intro;
  document.getElementById("detailBody").innerHTML=`
    <h2>À retenir</h2><p>${esc(intro)}</p>
    <h2>En pratique</h2><p>Cette fiche est prête à accueillir le contenu détaillé d'Anim Compagnon.</p>
    <h2>Points de vigilance</h2><p>Le contenu précis pourra être enrichi sans modifier la structure graphique.</p>`;
  go("detail");
}
function tool(title,intro){
  previous="toolbox";document.getElementById("detailTitle").textContent=title;document.getElementById("detailIntro").textContent="Boîte à outils";
  document.getElementById("detailBody").innerHTML=`<h2>${esc(title)}</h2><p>${esc(intro)}</p>
  ${title==="PSAADRAFRA"?`<h2>Les étapes</h2><p><strong>P</strong> Préparation<br><strong>S</strong> Sensibilisation<br><strong>A</strong> Accueil<br><strong>A</strong> Aménagement<br><strong>D</strong> Déroulement<br><strong>R</strong> Rythme<br><strong>A</strong> Animation<br><strong>F</strong> Fin<br><strong>R</strong> Rangement<br><strong>A</strong> Analyse</p>`:""}
  <div class="info"><strong>À retenir</strong><p>Je prépare l'activité… mais je m'adapte aux enfants. La fiche est prévue. Le groupe, lui, est vivant.</p></div>`;
  go("detail");
}

/* =========================================================
   🤖 IA
   ========================================================= */
document.querySelectorAll(".chip[data-filter]").forEach(b=>b.onclick=()=>b.classList.toggle("selected"));
function filters(){
  const out=[];document.querySelectorAll(".chip[data-filter].selected").forEach(b=>out.push(b.dataset.filter+": "+b.textContent.trim()));return out.join(" | ");
}
async function generate(){
  const prompt=document.getElementById("prompt").value.trim(),f=filters(),load=document.getElementById("genLoad"),res=document.getElementById("genResult");
  if(!prompt&&!f&&!document.getElementById("photo").files.length){toast("Décris ta situation ou choisis un paramètre.");return}
  load.classList.remove("hidden");res.classList.add("hidden");
  const message=`Tu es l'assistant pédagogique d'Anim Compagnon. Crée UNE activité concrète pour un animateur en ACM. Demande: ${prompt||"non précisée"}. Paramètres: ${f||"aucun"}. Réponds en français avec : TITRE, ÂGE / DURÉE / LIEU, OBJECTIFS PÉDAGOGIQUES, MATÉRIEL, DÉROULEMENT, VARIANTES, POINTS DE VIGILANCE.`;
  try{
    const r=await fetch(AI_API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:message})});
    if(!r.ok)throw Error(r.status);const d=await r.json();const text=d.output_text||d.text||d.response||(Array.isArray(d.output)?JSON.stringify(d.output):"");
    if(!text)throw Error("Réponse vide");
    res.innerHTML=`<div class="card">${formatAI(String(text))}</div><div style="height:10px"></div><div class="row"><button class="btn secondary" onclick="generate()">Autre activité</button><button class="btn green" onclick="toast('Modifie ta demande puis relance la génération.')">Affiner</button></div>`;
  }catch(e){res.innerHTML='<div class="card"><h2>Génération indisponible</h2><p>Le service IA n’a pas répondu correctement. Vérifie le Worker puis réessaie.</p></div>'}
  finally{load.classList.add("hidden");res.classList.remove("hidden")}
}
function formatAI(t){
  return esc(t).replace(/\n/g,"<br>").replace(/(?:^|<br>)(TITRE|ÂGE \/ DURÉE \/ LIEU|OBJECTIFS PÉDAGOGIQUES|MATÉRIEL|DÉROULEMENT|VARIANTES|POINTS DE VIGILANCE)(?=<br>|$)/g,'<h3>$1</h3>');
}

/* =========================================================
   🆘 HELP
   ========================================================= */
function helpAnalyse(){
  const q=document.getElementById("helpText").value.trim().toLowerCase(),r=document.getElementById("helpResult");
  if(!q){toast("Décris d'abord la situation.");return}
  const danger=["violence","frappe","blessure","marque","étrangle","abus","agression","attouche","viol","danger","maltrait","suicide","automutil"];
  const watch=["s'isole","s’isole","triste","peur","angoisse","changement de comportement","pleure","refuse"];
  let c="help-green",t="Problématique pédagogique / courante",m="Observe la situation, prends en compte le contexte et adapte ton accompagnement.";
  if(danger.some(x=>q.includes(x))){c="help-red";t="Situation préoccupante";m="Protège l'enfant et le groupe, préviens la direction et suis la procédure adaptée. N'enquête pas et ne pose pas toi-même de diagnostic."}
  else if(watch.some(x=>q.includes(x))){c="help-orange";t="À surveiller / à accompagner";m="Observe les faits, échange avec la direction et adapte l'accompagnement. Un changement de comportement mérite d'être pris au sérieux sans poser de diagnostic."}
  r.innerHTML=`<div class="help-level ${c}"><strong>${t}</strong>${m}</div><div class="info"><strong>Pistes</strong><p>Observer les faits concrets.<br>Adapter l'accompagnement immédiat.<br>Transmettre les éléments utiles à la personne responsable.<br>Consulter la fiche ressource correspondante.</p></div>`;
}

/* =========================================================
   ⭐ FAVORIS
   ========================================================= */
function getFav(){try{return JSON.parse(localStorage.getItem("animFav")||"[]")}catch{return[]}}
function favorite(a){const f=getFav(),i=f.findIndex(x=>x.id===a.id);if(i>=0){f.splice(i,1);toast("Retiré des favoris.")}else{f.push(a);toast("Ajouté aux favoris.")}localStorage.setItem("animFav",JSON.stringify(f))}
function renderFavorites(){
  const el=document.getElementById("favorites"),f=getFav();
  if(!f.length){el.className="empty";el.innerHTML="<strong>Aucun favori</strong>Les fiches que tu ajoutes apparaîtront ici.";return}
  el.className="";el.innerHTML=f.map((a,i)=>`<button class="card" style="width:100%;text-align:left;margin-bottom:8px" onclick="openFavorite(${i})"><h2>${esc(a.name)}</h2><p>${esc([a.age,a.duration].filter(Boolean).join(" • "))}</p></button>`).join("");
}
function openFavorite(i){const f=getFav(),a=f[i];if(a){window.rendered=[a];openActivity(0)}}

/* =========================================================
   🛡️ UTILITAIRES
   ========================================================= */
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
function short(v,n){v=String(v||"");return v.length>n?v.slice(0,n-1)+"…":v}
function toast(m){const e=document.getElementById("toast");e.textContent=m;e.classList.add("show");clearTimeout(window.tt);window.tt=setTimeout(()=>e.classList.remove("show"),2400)}

/* =========================================================
   🗂️ PROJETS & SÉANCES — BASEROW
   ========================================================= */

function statusText(v){
  if(v===null || v===undefined) return "";
  if(typeof v==="object") return String(v.value||"");
  return String(v);
}

function mapProjet(r){
  return {
    id:r.id,
    titre:String(r.TITRE || "Projet sans titre"),
    contexte:String(r.CONTEXTE || ""),
    dateDebut:String(r.DATE_DEBUT || ""),
    dateFin:String(r.DATE_FIN || ""),
    statut:statusText(r.STATUT),
    creePar:String(r["CRÉÉ_PAR"] || r.CREE_PAR || ""),
    actif:["oui","true","1","yes"].includes(String(r.Actif || "").toLowerCase())
  };
}

function mapSeance(r){
  return {
    id:r.id,
    titre:String(r.TITRE || "Séance sans titre"),
    numero:String(r.NUMERO || ""),
    date:String(r.DATE || ""),
    objectifs:String(r.OBJECTIFS || ""),
    contenu:String(r.CONTENU || ""),
    moyens:String(r.MOYENS || ""),
    evaluation:String(r.EVALUATION || ""),
    statut:statusText(r.STATUT),
    projetIds:Array.isArray(r.PROJET) ? r.PROJET.map(p=>p.id) : []
  };
}

async function loadProjets(){
  const loading=document.getElementById("projetsLoading");
  const list=document.getElementById("projetsList");
  if(loading)loading.classList.remove("hidden");
  try{
    const res=await fetch(PROJETS_API,{cache:"no-store"});
    if(!res.ok)throw Error(res.status);
    const data=await res.json();
    const rows=Array.isArray(data)?data:(data.results||[]);
    projets=rows.map(mapProjet);
    await loadSeances();
    renderProjetsList();
  }catch(e){
    console.error(e);
    if(loading)loading.classList.add("hidden");
    if(list)list.innerHTML='<div class="empty"><strong>Projets indisponibles</strong>Impossible de charger les projets pour le moment.</div>';
  }
}

async function loadSeances(){
  try{
    const res=await fetch(SEANCES_API,{cache:"no-store"});
    if(!res.ok)throw Error(res.status);
    const data=await res.json();
    const rows=Array.isArray(data)?data:(data.results||[]);
    seances=rows.map(mapSeance);
  }catch(e){
    console.error(e);
  }
}

function renderProjetsList(){
  const loading=document.getElementById("projetsLoading");
  const list=document.getElementById("projetsList");
  if(loading)loading.classList.add("hidden");
  if(!list)return;
  if(!projets.length){
    list.innerHTML='<div class="empty"><strong>Aucun projet</strong>Crée ton premier projet pédagogique.</div>';
    return;
  }
  list.innerHTML=projets.map((p,i)=>{
    const nbSeances=seances.filter(s=>s.projetIds.includes(p.id)).length;
    const meta=[p.statut,[p.dateDebut,p.dateFin].filter(Boolean).join(" → "),nbSeances?`${nbSeances} séance${nbSeances>1?"s":""}`:""].filter(Boolean).join(" • ");
    return `
      <button class="card" style="width:100%;text-align:left" onclick="openProjet(${i})">
        <h2>${esc(p.titre)}</h2>
        <p>${esc(meta)}</p>
      </button>
    `;
  }).join("");
}

function openProjet(i){
  const p=projets[i];if(!p)return;
  currentProjetId=p.id;
  previous="projets";
  document.getElementById("projetDetailTitle").textContent=p.titre;
  document.getElementById("projetDetailIntro").textContent=[p.statut,[p.dateDebut,p.dateFin].filter(Boolean).join(" → ")].filter(Boolean).join(" • ");
  document.getElementById("projetDetailBody").innerHTML=[
    ["Contexte",p.contexte],["Créé par",p.creePar]
  ].filter(x=>x[1]).map(x=>`<h2>${esc(x[0])}</h2><p style="white-space:pre-line">${esc(x[1])}</p>`).join("")
  || '<p>Aucune information complémentaire pour ce projet.</p>';
  const form=document.getElementById("seanceForm");
  if(form)form.hidden=true;
  renderProjetSeances();
  go("projetDetail");
}

function renderProjetSeances(){
  const list=document.getElementById("projetSeancesList");
  if(!list)return;
  const items=seances
    .filter(s=>s.projetIds.includes(currentProjetId))
    .sort((a,b)=>(Number(a.numero)||0)-(Number(b.numero)||0));
  if(!items.length){
    list.innerHTML='<div class="empty"><strong>Aucune séance</strong>Ajoute la première séance de ce projet.</div>';
    return;
  }
  list.innerHTML=items.map(s=>`
    <article class="card">
      <h2>${esc(s.numero?("Séance "+s.numero+" — "):"")+esc(s.titre)}</h2>
      <p>${esc([s.date,s.statut].filter(Boolean).join(" • "))}</p>
      ${s.objectifs?`<h3>Objectifs</h3><p style="white-space:pre-line">${esc(s.objectifs)}</p>`:""}
      ${s.contenu?`<h3>Contenu</h3><p style="white-space:pre-line">${esc(s.contenu)}</p>`:""}
      ${s.moyens?`<h3>Moyens</h3><p style="white-space:pre-line">${esc(s.moyens)}</p>`:""}
      ${s.evaluation?`<h3>Évaluation</h3><p style="white-space:pre-line">${esc(s.evaluation)}</p>`:""}
    </article>
  `).join("");
}

function openProjetForm(){
  const form=document.getElementById("projetForm");
  if(!form)return;
  form.hidden=!form.hidden;
  if(!form.hidden)form.scrollIntoView({behavior:"smooth",block:"start"});
}

async function submitNewProjet(){
  const titre=document.getElementById("projetTitre")?.value.trim()||"";
  const contexte=document.getElementById("projetContexte")?.value.trim()||"";
  const dateDebut=document.getElementById("projetDateDebut")?.value||"";
  const dateFin=document.getElementById("projetDateFin")?.value||"";
  const creePar=document.getElementById("projetCreePar")?.value.trim()||"";
  if(!titre){toast("Donne un titre à ton projet.");return}
  try{
    const body={
      TITRE:titre,
      CONTEXTE:contexte,
      STATUT:"En cours",
      "CRÉÉ_PAR":creePar,
      Actif:"Oui"
    };
    if(dateDebut)body.DATE_DEBUT=dateDebut;
    if(dateFin)body.DATE_FIN=dateFin;
    const res=await fetch(PROJETS_API,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body)
    });
    if(!res.ok)throw Error(res.status);
    toast("Projet créé.");
    const form=document.getElementById("projetForm");
    if(form)form.hidden=true;
    ["projetTitre","projetContexte","projetDateDebut","projetDateFin","projetCreePar"].forEach(id=>{
      const el=document.getElementById(id);if(el)el.value="";
    });
    await loadProjets();
  }catch(e){
    console.error(e);
    toast("Impossible de créer le projet.");
  }
}

function openSeanceForm(){
  const form=document.getElementById("seanceForm");
  if(!form)return;
  form.hidden=!form.hidden;
  if(!form.hidden)form.scrollIntoView({behavior:"smooth",block:"start"});
}

async function submitNewSeance(){
  if(!currentProjetId){toast("Sélectionne d'abord un projet.");return}
  const titre=document.getElementById("seanceTitre")?.value.trim()||"";
  const numero=document.getElementById("seanceNumero")?.value.trim()||"";
  const date=document.getElementById("seanceDate")?.value||"";
  const objectifs=document.getElementById("seanceObjectifs")?.value.trim()||"";
  const contenu=document.getElementById("seanceContenu")?.value.trim()||"";
  const moyens=document.getElementById("seanceMoyens")?.value.trim()||"";
  const evaluation=document.getElementById("seanceEvaluation")?.value.trim()||"";
  if(!titre){toast("Donne un titre à la séance.");return}
  try{
    const body={
      TITRE:titre,
      NUMERO:numero,
      OBJECTIFS:objectifs,
      CONTENU:contenu,
      MOYENS:moyens,
      EVALUATION:evaluation,
      STATUT:"À venir",
      Actif:"Oui",
      PROJET:[currentProjetId]
    };
    if(date)body.DATE=date;
    const res=await fetch(SEANCES_API,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body)
    });
    if(!res.ok)throw Error(res.status);
    toast("Séance ajoutée.");
    const form=document.getElementById("seanceForm");
    if(form)form.hidden=true;
    ["seanceTitre","seanceNumero","seanceDate","seanceObjectifs","seanceContenu","seanceMoyens","seanceEvaluation"].forEach(id=>{
      const el=document.getElementById(id);if(el)el.value="";
    });
    await loadSeances();
    renderProjetSeances();
    renderProjetsList();
  }catch(e){
    console.error(e);
    toast("Impossible d'ajouter la séance.");
  }
}

/* =========================================================
   🚀 DÉMARRAGE
   ========================================================= */
loadCategories();
loadActivities();
/* =========================================================
   📚 RESSOURCES — BASEROW
   ========================================================= */

const RESOURCES_API =
  "https://anim-compagnon-api.eliesbendjedou30.workers.dev/resources";

function resourceField(row,names){
  for(const name of names){
    if(row[name]!==undefined && row[name]!==null && String(row[name]).trim()!==""){
      return row[name];
    }
  }
  return "";
}

function resourceText(value){
  if(value===null || value===undefined) return "";
  if(typeof value==="string") return value;
  if(typeof value==="object"){
    if(value.value!==undefined) return String(value.value);
    if(value.name!==undefined) return String(value.name);
  }
  return String(value);
}

function resourceFileUrl(value){
  if(!value) return "";
  if(Array.isArray(value)){
    const file=value[0];
    return file && file.url ? file.url : "";
  }
  if(typeof value==="object" && value.url) return value.url;
  return "";
}

function mapResource(row){
  const actif=resourceField(row,["Actif","ACTIF","actif"]);
  return {
    id:row.id,
    title:resourceText(resourceField(row,["TITRE","Titre","titre"])),
    category:resourceText(resourceField(row,["CATÉGORIES","CATEGORIES","Catégories","Catégorie"])),
    subcategory:resourceText(resourceField(row,["SOUS-CATÉGORIE","SOUS-CATEGORIE","Sous-catégorie","Sous-categorie"])),
    summary:resourceText(resourceField(row,["RÉSUMÉ","RESUME","Résumé","resume"])),
    pdf:resourceFileUrl(resourceField(row,["PDF","Pdf","pdf"])),
    order:Number(resourceField(row,["ORDRE","Ordre","ordre"])) || 9999,
    active:actif===true || ["true","1","oui","yes","vrai"].includes(String(actif).toLowerCase())
  };
}

function renderPublics(){
  const list=document.getElementById("publicsList");
  if(!list) return;

  const publicResources=resources.filter(r=>
    String(r.category).trim().toUpperCase()==="PUBLICS"
  );

  const subcategories=[];
  publicResources.forEach(r=>{
    const sub=String(r.subcategory||"").trim();
    if(sub && !subcategories.some(s=>s.toLowerCase()===sub.toLowerCase())){
      subcategories.push(sub);
    }
  });

  if(!subcategories.length){
    list.innerHTML='<div class="empty"><strong>Aucun public disponible</strong>Les fiches de publics seront bientôt disponibles.</div>';
    return;
  }

  list.innerHTML=subcategories.map(sub=>{
    const count=publicResources.filter(r=>
      String(r.subcategory||"").trim().toLowerCase()===sub.toLowerCase()
    ).length;
    return `
      <button class="card resource-card" onclick="openPublicSubcategory(${JSON.stringify(sub)})">
        <div class="resource-img" style="--img:none"></div>
        <div class="resource-info">
          <h2>${esc(sub)}</h2>
          <p>${count} fiche${count>1?"s":""} disponible${count>1?"s":""}</p>
        </div>
      </button>
    `;
  }).join("");
}

/* ===== PAGES SIMPLES ALIMENTÉES PAR BASEROW ===== */
function renderResourceCategoryPage(listId,categoryValue){
  const list=document.getElementById(listId);
  if(!list) return;

  const items=resources.filter(r=>
    String(r.category).trim().toUpperCase()===categoryValue
  );

  if(!items.length){
    list.innerHTML='<div class="empty"><strong>Aucune fiche</strong>Aucune fiche publiée pour le moment.</div>';
    return;
  }

  list.innerHTML=items.map(r=>`
    <article class="card">
      <h2>${esc(r.title||"Fiche sans titre")}</h2>
      ${r.summary?`<p>${esc(r.summary)}</p>`:""}
      ${r.pdf?`<div style="height:10px"></div><button class="btn primary full" onclick="openResourcePDF(${Number(r.id)})">Ouvrir la fiche PDF</button>`:""}
    </article>
  `).join("");
}

function renderResourcesPage(){
  const loading=document.getElementById("resourcesLoading");
  if(loading)loading.classList.add("hidden");
  renderResourceCategoryPage("resourcesList","RESSOURCES");
}
function renderRolePage(){ renderResourceCategoryPage("roleList","ROLE"); }
function renderDailyPage(){ renderResourceCategoryPage("dailyList","QUOTIDIEN"); }
function renderToolboxPage(){ renderResourceCategoryPage("toolboxList","OUTILS"); }
function openPublicSubcategory(subcategory){
  const title=document.getElementById("publicSubcategoryTitle");
  const intro=document.getElementById("publicSubcategoryIntro");
  const list=document.getElementById("publicSubcategoryList");
  if(!title || !intro || !list) return;

  const wanted=String(subcategory || "").trim().toLowerCase();

  const matches=resources
    .filter(resource=>
      String(resource.category).trim().toLowerCase()==="publics" &&
      String(resource.subcategory || "").trim().toLowerCase()===wanted
    )
    .sort((a,b)=>a.order-b.order);

  title.textContent=subcategory;
  intro.textContent="Les fiches disponibles pour ce public.";

  list.innerHTML=matches.length ? matches.map(resource=>`
    <article class="card">
      <h2>${esc(resource.title || "Ressource sans titre")}</h2>
      ${resource.summary ? `<p>${esc(resource.summary)}</p>` : ""}
      ${resource.pdf ? `
        <div style="height:10px"></div>
        <button class="btn primary full" onclick="openResourcePDF(${Number(resource.id)})">
          Ouvrir la fiche PDF
        </button>
      ` : ""}
    </article>
  `).join("") : `
    <div class="empty">
      <strong>Aucune fiche</strong>
      Aucune ressource n'est disponible pour ce public.
    </div>
  `;

  go("publicSubcategory");
}

function openResourcePDF(id){

  const resource = resources.find(
    r => Number(r.id) === Number(id)
  );

  if(!resource){
    toast("Fiche introuvable.");
    return;
  }

  if(!resource.pdf){
    toast("Aucun PDF associé à cette fiche.");
    return;
  }

  window.location.href = resource.pdf;
}
async function loadResources(){
  try{
    const res=await fetch(RESOURCES_API,{cache:"no-store"});
    if(!res.ok)throw Error(res.status);
    const data=await res.json();
    const rows=Array.isArray(data)?data:(data.results||[]);
    resources=rows.map(mapResource).filter(r=>r.active).sort((a,b)=>a.order-b.order);
    renderPublics();
    renderResourcesPage();
  }catch(e){
    console.error(e);
    const loading=document.getElementById("resourcesLoading");
    const list=document.getElementById("resourcesList");
    if(loading)loading.classList.add("hidden");
    if(list)list.innerHTML='<div class="empty"><strong>Ressources indisponibles</strong>Impossible de charger le contenu Baserow pour le moment.</div>';
    const publicsList=document.getElementById("publicsList");
    if(publicsList)publicsList.innerHTML='<div class="empty"><strong>Publics indisponibles</strong>Impossible de charger le contenu Baserow pour le moment.</div>';
  }
}

function renderResourcesPage(){
  const loading=document.getElementById("resourcesLoading");
  const list=document.getElementById("resourcesList");
  if(!list)return;
  if(loading)loading.classList.add("hidden");

  const items=resources.filter(r=>String(r.category).trim().toLowerCase()==="ressources");

  if(!items.length){
    list.innerHTML='<div class="empty"><strong>Aucune ressource</strong>Aucune ressource publiée pour le moment.</div>';
    return;
  }

  list.innerHTML=items.map(r=>`
    <article class="card">
      <h2>${esc(r.title||"Ressource sans titre")}</h2>
      ${r.summary?`<p>${esc(r.summary)}</p>`:""}
      ${r.pdf?`<div style="height:10px"></div><button class="btn primary full" onclick="openResourcePDF(${Number(r.id)})">Ouvrir la fiche PDF</button>`:""}
    </article>
  `).join("");
}
loadResources();
/* =========================================================
   ✨ GÉNÉRATEUR D'ACTIVITÉ
   ========================================================= */

let aiProposals = [];
let selectedAIProposal = null;


/* =========================================================
   NAVIGATION DU GÉNÉRATEUR
   ========================================================= */

function openGeneratorMode(mode){

  const iaChoice = document.getElementById("generatorIAChoice");
  const iaText = document.getElementById("generatorIAText");
  const iaPhoto = document.getElementById("generatorIAPhoto");

  if(iaChoice) iaChoice.hidden = true;
  if(iaText) iaText.hidden = true;
  if(iaPhoto) iaPhoto.hidden = true;

  const proposals = document.getElementById("aiGeneratedProposals");
  const sheet = document.getElementById("aiGeneratedSheet");

  if(proposals) proposals.remove();
  if(sheet) sheet.remove();

  if(mode === "ia"){

    if(iaChoice) iaChoice.hidden = false;

    return;
  }

  if(mode === "ia-text"){

    if(iaText) iaText.hidden = false;

    return;
  }

  if(mode === "ia-photo"){

    if(iaPhoto) iaPhoto.hidden = false;

    return;
  }

  if(mode === "fiche"){

    toast("Le générateur de fiche arrive.");

    return;
  }
}


/* =========================================================
   🤖 GÉNÉRATION DES 3 PROPOSITIONS
   ========================================================= */

async function generateAIActivity(){

  const age =
    document.getElementById("aiAge")?.value.trim() || "";

  const children =
    document.getElementById("aiChildren")?.value.trim() || "";

  const duration =
    document.getElementById("aiDuration")?.value.trim() || "";

  const place =
    document.getElementById("aiPlace")?.value.trim() || "";

  const material =
    document.getElementById("aiMaterial")?.value.trim() || "";

  const objective =
    document.getElementById("aiObjective")?.value.trim() || "";


  if(
    !age &&
    !children &&
    !duration &&
    !place &&
    !material &&
    !objective
  ){

    toast("Décris au moins un peu ton besoin.");

    return;
  }


  toast("Je cherche des idées pour toi…");


  const prompt = `
Tu es l'assistant pédagogique d'Anim Compagnon.

Tu aides un animateur en ACM à trouver des activités concrètes,
réalisables et adaptées à son contexte.

Voici sa demande :

Âge des enfants : ${age || "non précisé"}
Nombre d'enfants : ${children || "non précisé"}
Durée : ${duration || "non précisée"}
Lieu : ${place || "non précisé"}
Matériel disponible : ${material || "non précisé"}
Objectif ou envie : ${objective || "non précisé"}

PROPOSE EXACTEMENT 3 ACTIVITÉS DIFFÉRENTES.

Les trois activités doivent être réellement différentes
et adaptées aux informations données.

Réponds UNIQUEMENT avec un JSON valide.

Format obligatoire :

{
  "propositions": [
    {
      "titre": "Nom de l'activité",
      "description": "Courte présentation de l'activité en 2 ou 3 phrases.",
      "age": "8-12 ans",
      "duree": "30 min",
      "lieu": "Extérieur",
      "energie": "Dynamique",
      "objectifs": [
        "Coopération",
        "Motricité"
      ],
      "materiel": [
        "4 plots",
        "3 ballons"
      ]
    }
  ]
}

Ne mets aucun texte avant ou après le JSON.
`;


  try{

    const response = await fetch(AI_API,{

      method:"POST",

      headers:{
        "Content-Type":"application/json"
      },

      body:JSON.stringify({
        prompt:prompt
      })

    });


    if(!response.ok){

      const errorText = await response.text();

      console.error("Erreur Worker :",errorText);

      throw new Error("Erreur Worker : " + response.status);

    }


    const data = await response.json();


    let result = "";


    if(typeof data.output_text === "string"){

      result = data.output_text;

    }


    if(!result && Array.isArray(data.output)){

      for(const item of data.output){

        if(!Array.isArray(item.content)) continue;

        for(const content of item.content){

          if(typeof content.text === "string"){

            result += content.text;

          }

        }

      }

    }


    if(!result && typeof data.text === "string"){

      result = data.text;

    }


    if(!result && typeof data.response === "string"){

      result = data.response;

    }


    result = result.trim();


    if(!result){

      throw new Error("Réponse IA vide.");

    }


    /*
      Sécurité : si l'IA ajoute accidentellement
      des ```json ... ```, on les retire.
    */

    result = result
      .replace(/^```json\s*/i,"")
      .replace(/^```\s*/i,"")
      .replace(/\s*```$/,"")
      .trim();


    const parsed = JSON.parse(result);


    if(
      !parsed.propositions ||
      !Array.isArray(parsed.propositions) ||
      parsed.propositions.length === 0
    ){

      throw new Error("Aucune proposition reçue.");

    }


    aiProposals = parsed.propositions.slice(0,3);


    showAIProposals();


  }catch(error){

    console.error("Erreur génération IA :",error);

    toast("L'IA n'a pas réussi à générer les propositions.");

  }

}


/* =========================================================
   🎲 AFFICHAGE DES 3 PROPOSITIONS
   ========================================================= */

function showAIProposals(){

  const existing =
    document.getElementById("aiGeneratedProposals");

  if(existing){

    existing.remove();

  }


  const section =
    document.createElement("section");

  section.id = "aiGeneratedProposals";
  section.className = "section generator-panel";


  section.innerHTML = `

    <div class="section-head">

      <h2 class="section-title">
        🎲 J'ai quelques idées pour toi
      </h2>

      <p class="page-intro">
        Choisis celle qui te plaît le plus.
        Je préparerai ensuite la fiche complète.
      </p>

    </div>


    <div class="ai-proposals">

      ${aiProposals.map((proposal,index)=>{

        const objectives =
          Array.isArray(proposal.objectifs)
            ? proposal.objectifs
            : [];

        const material =
          Array.isArray(proposal.materiel)
            ? proposal.materiel
            : [];

        return `

          <article class="ai-proposal">

            <div class="ai-proposal-top">

              <span class="ai-proposal-number">
                ${index + 1}
              </span>

              <h3 class="ai-proposal-title">
                ${esc(proposal.titre || "Activité")}
              </h3>

            </div>


            <p class="ai-proposal-description">

              ${esc(
                proposal.description ||
                "Une activité adaptée à ta demande."
              )}

            </p>


            <div class="ai-proposal-meta">

              ${proposal.age
                ? `<span class="ai-meta">👥 ${esc(proposal.age)}</span>`
                : ""}

              ${proposal.duree
                ? `<span class="ai-meta">⏱️ ${esc(proposal.duree)}</span>`
                : ""}

              ${proposal.lieu
                ? `<span class="ai-meta">📍 ${esc(proposal.lieu)}</span>`
                : ""}

              ${proposal.energie
                ? `<span class="ai-meta">⚡ ${esc(proposal.energie)}</span>`
                : ""}

            </div>


            ${
              objectives.length
              ?
              `
              <div class="ai-proposal-objectives">

                ${objectives
                  .slice(0,5)
                  .map(o =>
                    `<span class="ai-objective">
                      ${esc(o)}
                    </span>`
                  )
                  .join("")}

              </div>
              `
              :
              ""
            }


            ${
              material.length
              ?
              `
              <div class="ai-proposal-description">

                🧰 ${material
                  .slice(0,5)
                  .map(m => esc(m))
                  .join(" · ")}

              </div>
              `
              :
              ""
            }


            <button
              class="ai-proposal-button"
              onclick="generateActivitySheet(${index})"
            >
              📋 Créer la fiche de cette activité
            </button>

          </article>

        `;

      }).join("")}

    </div>

  `;


  const generatorText =
    document.getElementById("generatorIAText");


  if(generatorText){

    generatorText.insertAdjacentElement(
      "afterend",
      section
    );

  }


  section.scrollIntoView({
    behavior:"smooth",
    block:"start"
  });

}


/* =========================================================
   📋 GÉNÉRATION DE LA FICHE COMPLÈTE
   ========================================================= */

async function generateActivitySheet(index){

  const proposal = aiProposals[index];

  if(!proposal){

    toast("Cette activité n'est plus disponible.");

    return;

  }


  selectedAIProposal = proposal;


  toast("Je prépare la fiche complète…");


  const prompt = `
Tu es l'assistant pédagogique d'Anim Compagnon.

Transforme cette proposition d'activité en une fiche
complète, claire et directement utilisable par un animateur ACM.

PROPOSITION :

${JSON.stringify(proposal, null, 2)}

Crée une fiche pratique.

Tu dois respecter impérativement :
- l'âge
- le nombre d'enfants si disponible
- la durée
- le lieu
- le matériel
- l'objectif
- la faisabilité réelle de l'activité

Réponds UNIQUEMENT avec un JSON valide.

Format :

{
  "titre": "",
  "age": "",
  "nombre_enfants": "",
  "duree": "",
  "temps_preparation": "",
  "lieu": "",
  "energie": "",
  "objectifs": [],
  "materiel": [],
  "preparation": "",
  "deroulement": [],
  "variantes": [],
  "adaptations": [],
  "points_vigilance": [],
  "posture_animateur": ""
}

Le déroulement doit être présenté sous forme d'étapes
claires et concrètes.

Ne mets aucun texte avant ou après le JSON.
`;


  try{

    const response = await fetch(AI_API,{

      method:"POST",

      headers:{
        "Content-Type":"application/json"
      },

      body:JSON.stringify({
        prompt:prompt
      })

    });


    if(!response.ok){

      throw new Error(
        "Erreur Worker : " + response.status
      );

    }


    const data = await response.json();


    let result = "";


    if(typeof data.output_text === "string"){

      result = data.output_text;

    }


    if(!result && Array.isArray(data.output)){

      for(const item of data.output){

        if(!Array.isArray(item.content)) continue;

        for(const content of item.content){

          if(typeof content.text === "string"){

            result += content.text;

          }

        }

      }

    }


    if(!result && typeof data.text === "string"){

      result = data.text;

    }


    if(!result && typeof data.response === "string"){

      result = data.response;

    }


    result = result
      .replace(/^```json\s*/i,"")
      .replace(/^```\s*/i,"")
      .replace(/\s*```$/,"")
      .trim();


    const sheet = JSON.parse(result);


    showActivitySheet(sheet);


  }catch(error){

    console.error(
      "Erreur génération fiche :",
      error
    );

    toast(
      "Impossible de créer la fiche pour le moment."
    );

  }

}


/* =========================================================
   📖 AFFICHAGE DE LA FICHE
   ========================================================= */

function showActivitySheet(sheet){
window.currentAISheet = sheet;
const favorites = getAIFavorites();

const isFavorite = favorites.some(
  item =>
    item.titre === sheet.titre
);

setTimeout(() => {
  updateFavoriteButton(isFavorite);
}, 0);
  const existing =
    document.getElementById("aiGeneratedSheet");

  if(existing){

    existing.remove();

  }


  const section =
    document.createElement("section");


  section.id = "aiGeneratedSheet";
  section.className = "section generator-panel";


  const objectives =
    Array.isArray(sheet.objectifs)
      ? sheet.objectifs
      : [];


  const material =
    Array.isArray(sheet.materiel)
      ? sheet.materiel
      : [];


  const steps =
    Array.isArray(sheet.deroulement)
      ? sheet.deroulement
      : [];


  const variants =
    Array.isArray(sheet.variantes)
      ? sheet.variantes
      : [];


  const adaptations =
    Array.isArray(sheet.adaptations)
      ? sheet.adaptations
      : [];


  const vigilance =
    Array.isArray(sheet.points_vigilance)
      ? sheet.points_vigilance
      : [];


  section.innerHTML = `

    <div class="section-head">

      <h2 class="section-title">
        📋 Ta fiche d'activité
      </h2>

      <p class="page-intro">
        Prête à être utilisée sur le terrain.
      </p>

    </div>


    <article class="ai-activity-sheet">


      <!-- EN-TÊTE -->

      <header class="ai-sheet-header">

        <h1 class="ai-sheet-title">
          ${esc(sheet.titre || "Activité")}
        </h1>


        <div class="ai-sheet-meta">

          ${
            sheet.age
            ? `<span class="ai-meta">
                👥 ${esc(sheet.age)}
              </span>`
            : ""
          }

          ${
            sheet.nombre_enfants
            ? `<span class="ai-meta">
                🧒 ${esc(sheet.nombre_enfants)}
              </span>`
            : ""
          }

          ${
            sheet.duree
            ? `<span class="ai-meta">
                ⏱️ ${esc(sheet.duree)}
              </span>`
            : ""
          }

          ${
            sheet.lieu
            ? `<span class="ai-meta">
                📍 ${esc(sheet.lieu)}
              </span>`
            : ""
          }

          ${
            sheet.energie
            ? `<span class="ai-meta">
                ⚡ ${esc(sheet.energie)}
              </span>`
            : ""
          }

        </div>

      </header>
<div class="ai-sheet-actions">

  <button
    id="aiFavoriteButton"
    class="ai-sheet-action ai-sheet-action-primary"
    onclick="toggleAIFavorite()"
  >
    ♡ Ajouter aux favoris
  </button>

  <button
    class="ai-sheet-action"
    onclick="downloadAIFiche()"
  >
    ↓ Télécharger
  </button>

  <button
    class="ai-sheet-action"
    onclick="printAIFiche()"
  >
    🖨 Imprimer
  </button>

</div>

      <!-- OBJECTIFS -->

      ${
        objectives.length
        ?
        `
        <section class="ai-sheet-section">

          <h3>🎯 Objectifs pédagogiques</h3>

          <div class="ai-proposal-objectives">

            ${objectives
              .map(o =>
                `<span class="ai-objective">
                  ${esc(o)}
                </span>`
              )
              .join("")}

          </div>

        </section>
        `
        :
        ""
      }


      <!-- MATÉRIEL -->

      ${
        material.length
        ?
        `
        <section class="ai-sheet-section">

          <h3>🧰 Matériel</h3>

          <div class="ai-sheet-material">

            ${material
              .map(m =>
                `<span class="ai-material-item">
                  ${esc(m)}
                </span>`
              )
              .join("")}

          </div>

        </section>
        `
        :
        ""
      }


      <!-- PRÉPARATION -->

      ${
        sheet.preparation
        ?
        `
        <section class="ai-sheet-section">

          <h3>🛠️ Préparation</h3>

          <p>
            ${formatText(sheet.preparation)}
          </p>

        </section>
        `
        :
        ""
      }


      <!-- DÉROULEMENT -->

      ${
        steps.length
        ?
        `
        <section class="ai-sheet-section">

          <h3>🎬 Déroulement</h3>

          <ol>

            ${steps
              .map(step =>
                `<li>
                  ${formatText(
                    typeof step === "string"
                      ? step
                      : JSON.stringify(step)
                  )}
                </li>`
              )
              .join("")}

          </ol>

        </section>
        `
        :
        ""
      }


      <!-- VARIANTES -->

      ${
        variants.length
        ?
        `
        <section class="ai-sheet-section">

          <h3>🔄 Variantes</h3>

          ${variants
            .map(v =>
              `
              <div class="ai-sheet-variant">
                ${formatText(
                  typeof v === "string"
                    ? v
                    : JSON.stringify(v)
                )}
              </div>
              `
            )
            .join("")}

        </section>
        `
        :
        ""
      }


      <!-- ADAPTATIONS -->

      ${
        adaptations.length
        ?
        `
        <section class="ai-sheet-section">

          <h3>♿ Adaptations</h3>

          <ul>

            ${adaptations
              .map(a =>
                `<li>
                  ${formatText(
                    typeof a === "string"
                      ? a
                      : JSON.stringify(a)
                  )}
                </li>`
              )
              .join("")}

          </ul>

        </section>
        `
        :
        ""
      }


      <!-- VIGILANCE -->

      ${
        vigilance.length
        ?
        `
        <section class="ai-sheet-section">

          <h3>⚠️ Points de vigilance</h3>

          <div class="ai-sheet-vigilance">

            <ul>

              ${vigilance
                .map(v =>
                  `<li>
                    ${formatText(
                      typeof v === "string"
                        ? v
                        : JSON.stringify(v)
                    )}
                  </li>`
                )
                .join("")}

            </ul>

          </div>

        </section>
        `
        :
        ""
      }


      <!-- POSTURE -->

      ${
        sheet.posture_animateur
        ?
        `
        <section class="ai-sheet-section">

          <h3>🧑‍🏫 Posture de l'animateur</h3>

          <div class="ai-sheet-posture">

            ${formatText(sheet.posture_animateur)}

          </div>

        </section>
        `
        :
        ""
      }


    </article>


    <button
      class="primary-btn ai-back-button"
      onclick="backToAIProposals()"
    >
      ← Voir les autres propositions
    </button>


  `;


  const proposals =
    document.getElementById(
      "aiGeneratedProposals"
    );


  if(proposals){

    proposals.insertAdjacentElement(
      "afterend",
      section
    );

  }else{

    const generatorText =
      document.getElementById(
        "generatorIAText"
      );

    if(generatorText){

      generatorText.insertAdjacentElement(
        "afterend",
        section
      );

    }

  }


  section.scrollIntoView({
    behavior:"smooth",
    block:"start"
  });
setTimeout(() => {
  updateFavoriteButton(isFavorite);
}, 0);

}


/* =========================================================
   ↩️ RETOUR AUX PROPOSITIONS
   ========================================================= */

function backToAIProposals(){

  const sheet =
    document.getElementById(
      "aiGeneratedSheet"
    );

  if(sheet){

    sheet.remove();

  }


  const proposals =
    document.getElementById(
      "aiGeneratedProposals"
    );


  if(proposals){

    proposals.scrollIntoView({
      behavior:"smooth",
      block:"start"
    });

  }

}


/* =========================================================
   🧹 FORMATAGE
   ========================================================= */

function formatText(value){

  if(value === null || value === undefined){

    return "";

  }

  return esc(String(value))
    .replace(/\n/g,"<br>");

}


/* =========================================================
   📸 PHOTO DU MATÉRIEL
   ========================================================= */

function handleMaterialPhoto(event){

  const file =
    event.target.files[0];

  if(!file) return;


  const preview =
    document.getElementById(
      "photoPreview"
    );


  if(!preview) return;


  const url =
    URL.createObjectURL(file);


  preview.hidden = false;


  preview.innerHTML = `

    <img
      src="${url}"
      alt="Photo du matériel"
      style="
        width:100%;
        max-height:300px;
        object-fit:cover;
        border-radius:20px;
      "
    >

    <button
      class="primary-btn"
      onclick="analyzeMaterialPhoto()"
    >
      ✨ Trouver des activités
    </button>

  `;

}


/* =========================================================
   🤖 ANALYSE PHOTO
   ========================================================= */

function analyzeMaterialPhoto(){

  toast(
    "L'analyse photo sera branchée ensuite."
  );

}
/* =========================================================
   ⭐ FAVORIS — FICHE IA
   ========================================================= */

function getAIFavorites(){

  try{

    return JSON.parse(
      localStorage.getItem("animCompagnonAIFavorites") || "[]"
    );

  }catch(error){

    return [];

  }

}


function saveAIFavorites(favorites){

  localStorage.setItem(
    "animCompagnonAIFavorites",
    JSON.stringify(favorites)
  );

}


function toggleAIFavorite(){

  if(!selectedAIProposal){

    toast("Aucune activité sélectionnée.");

    return;

  }

  const favorites = getAIFavorites();

  const index = favorites.findIndex(
    item =>
      item.titre === selectedAIProposal.titre
  );


  if(index !== -1){

    favorites.splice(index,1);

    saveAIFavorites(favorites);

    updateFavoriteButton(false);

    toast("Activité retirée des favoris.");

    return;

  }


  favorites.push({

    id:
      "ai-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .substring(2,8),

    type:"ai",

    titre:selectedAIProposal.titre,

    proposal:selectedAIProposal,

    fiche:window.currentAISheet || null,

    createdAt:new Date().toISOString()

  });


  saveAIFavorites(favorites);

  updateFavoriteButton(true);

  toast("Activité ajoutée aux favoris ⭐");

}


function updateFavoriteButton(isFavorite){

  const button =
    document.getElementById(
      "aiFavoriteButton"
    );


  if(!button) return;


  if(isFavorite){

    button.classList.add(
      "ai-favorite-active"
    );

    button.innerHTML =
      "♥ Dans mes favoris";

  }else{

    button.classList.remove(
      "ai-favorite-active"
    );

    button.innerHTML =
      "♡ Ajouter aux favoris";

  }

}
function printAIFiche(){
  if(!window.currentAISheet){
    toast("Aucune fiche à imprimer.");
    return;
  }
  window.print();
}
/* ===== CONTENU DE LA FICHE (utilisé pour Word et PDF) ===== */
function ficheToHTML(s){
  const list = (arr, tag="ul") => Array.isArray(arr) && arr.length
    ? `<${tag}>` + arr.map(x => `<li>${esc(typeof x === "string" ? x : JSON.stringify(x))}</li>`).join("") + `</${tag}>`
    : "";
  const block = (titre, contenu) => contenu ? `<h2>${titre}</h2>${contenu}` : "";

  return `
    <h1>${esc(s.titre || "Activité")}</h1>
    <p>${[s.age, s.nombre_enfants, s.duree, s.lieu, s.energie].filter(Boolean).map(esc).join(" · ")}</p>
    ${block("Objectifs pédagogiques", list(s.objectifs))}
    ${block("Matériel", list(s.materiel))}
    ${block("Préparation", s.preparation ? `<p>${esc(s.preparation)}</p>` : "")}
    ${block("Déroulement", list(s.deroulement, "ol"))}
    ${block("Variantes", list(s.variantes))}
    ${block("Adaptations", list(s.adaptations))}
    ${block("Points de vigilance", list(s.points_vigilance))}
    ${block("Posture de l'animateur", s.posture_animateur ? `<p>${esc(s.posture_animateur)}</p>` : "")}
  `;
}

function ficheFileName(s){
  return (s.titre || "fiche-activite")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^\w\-]+/g,"_");
}

/* ===== LE CHOIX WORD / PDF ===== */
function downloadAIFiche(){
  if(!window.currentAISheet){
    toast("Aucune fiche à télécharger.");
    return;
  }

  const existing = document.getElementById("aiDownloadChoice");
  if(existing){ existing.remove(); return; }

  const panel = document.createElement("div");
  panel.id = "aiDownloadChoice";
  panel.className = "ai-sheet-actions";
  panel.innerHTML = `
    <button class="ai-sheet-action" onclick="downloadFicheWord()">📝 Word</button>
    <button class="ai-sheet-action" onclick="downloadFichePDF()">📄 PDF</button>
  `;

  document.querySelector(".ai-sheet-actions")
    .insertAdjacentElement("afterend", panel);
}

/* ===== WORD ===== */
function downloadFicheWord(){
  const s = window.currentAISheet;
  if(!s) return;

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><title>${esc(s.titre || "Fiche")}</title></head>
    <body style="font-family:Calibri,Arial,sans-serif">${ficheToHTML(s)}</body>
    </html>`;

  const blob = new Blob(["\ufeff" + html], {type:"application/msword;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = ficheFileName(s) + ".doc";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  toast("Fiche Word téléchargée.");
}

/* ===== PDF ===== */
function downloadFichePDF(){
  const s = window.currentAISheet;
  if(!s) return;

  if(typeof html2pdf === "undefined"){
    toast("Le module PDF n'est pas chargé.");
    return;
  }

  const box = document.createElement("div");
  box.style.cssText = "position:absolute;left:-9999px;top:0;width:700px;padding:20px;background:#fff;color:#111;font-family:Calibri,Arial,sans-serif;font-size:14px;line-height:1.5";
  box.innerHTML = ficheToHTML(s);
  document.body.appendChild(box);

  html2pdf().set({
    margin: 12,
    filename: ficheFileName(s) + ".pdf",
    html2canvas: {scale: 2},
    jsPDF: {unit:"mm", format:"a4", orientation:"portrait"}
  }).from(box).save()
    .then(() => toast("Fiche PDF téléchargée."))
    .catch(() => toast("Impossible de créer le PDF."))
    .finally(() => box.remove());
}
