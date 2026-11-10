(()=>{
  const smallWords=new Set(['a','an','and','as','at','but','by','for','from','in','into','nor','of','on','or','per','the','to','via','with']);
  const acronyms=new Set(['PIC','PDF','QC','HOD','URL','ID','API','VIP']);
  const selector='button:not(.my-task-open-task),label,th,option,[role="option"],h1,h2,.panel-title,.stat-label,.nav-group-title,.project-eyebrow';
  const titleCase=text=>text.replace(/[A-Za-z0-9][A-Za-z0-9'’-]*/g,(word,offset)=>{
    const upper=word.toUpperCase(),base=upper.endsWith('S')?upper.slice(0,-1):upper;
    if(/^[A-Z0-9]{2,}$/.test(word)||acronyms.has(base))return word;
    const lower=word.toLowerCase();
    if(offset>0&&smallWords.has(lower))return lower;
    return lower.charAt(0).toUpperCase()+lower.slice(1);
  });
  const formatElement=element=>{
    if(!(element instanceof Element)||!element.matches(selector))return;
    for(const node of element.childNodes){
      if(node.nodeType===Node.TEXT_NODE){
        const formatted=titleCase(node.nodeValue);
        if(formatted!==node.nodeValue)node.nodeValue=formatted;
      }
    }
  };
  const formatTree=root=>{
    if(root instanceof Element)formatElement(root);
    root.querySelectorAll?.(selector).forEach(formatElement);
  };
  formatTree(document.body);
  new MutationObserver(records=>records.forEach(record=>{
    if(record.type==='characterData')formatElement(record.target.parentElement);
    else record.addedNodes.forEach(node=>{if(node.nodeType===Node.ELEMENT_NODE)formatTree(node)});
  })).observe(document.body,{subtree:true,childList:true,characterData:true});
})();
