import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PublicLocaleProvider, usePublicLocale } from '@/components/providers/public-locale-provider';
import { SiteHeader } from '@/components/navigation/site-header';
import { PublicHotspotCard } from '@/components/public-hotspots/public-hotspot-card';
import { PublicDetail, PublicHotspotState } from '@/components/public-hotspots/public-hotspot-explorer';
import { EvidenceScoringView, type TabId } from '@/components/evidence/evidence-scoring-workspace';
import { Queue, Brief, DecisionRail, RecommendationDraftForm, ProjectImpactCard, Loading, State } from '@/components/csr-impact/csr-impact-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { bundle, hotspot, scoreFixture, publicItems, recommendation, project, metrics } from './fixtures';
import '@/app/globals.css';
import './preview.css';

function Preview() {
  const {locale,t} = usePublicLocale();
  const [surface,setSurface] = useState('public');
  const [selectedId,setSelectedId] = useState<string|null>(null);
  const [tab,setTab] = useState<TabId>('overview');
  const [note,setNote] = useState(''); const [reason,setReason] = useState('');
  const [hotspotId,setHotspotId] = useState('hotspot-1'); const [bundleId,setBundleId] = useState('bundle-1'); const [title,setTitle] = useState(`drainage · ${bundle.geography.locality}`);
  const [message,setMessage] = useState(''); const [large,setLarge] = useState(false);
  const selected=publicItems.find(item=>item.id===selectedId);
  return <><style>{`html {font-size:${large?32:16}px}`}</style><div data-no-ui-translation className="fixture-banner">ISOLATED TEST FIXTURES · no live records, staff session, or API writes</div><SiteHeader/><nav data-no-ui-translation aria-label="Fixture surfaces" className="fixture-toolbar">{['public','evidence','policy','impact','states'].map(value=><Button key={value} aria-pressed={surface===value} variant={surface===value?'default':'outline'} onClick={()=>{setSurface(value);setSelectedId(null);}}>{value}</Button>)}<Button variant="outline" aria-pressed={large} onClick={()=>setLarge(!large)}>Text size {large?'100%':'200%'}</Button></nav>
    {message && <p data-no-ui-translation role="status" className="fixture-message">{message}</p>}
    {surface==='public' && <main id="main-content" className="fixture-content"><h1 className="mb-6 font-heading text-4xl">Populated public cards · test records</h1><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{publicItems.map(item=><PublicHotspotCard key={item.id} item={item} selected={selectedId===item.id} onSelect={setSelectedId}/>)}</div>{selected && <PublicDetail item={selected} onClose={()=>setSelectedId(null)} locale={locale} t={t}/>}</main>}
    {surface==='evidence' && <EvidenceScoringView hotspotId="hotspot-1" bundle={bundle} hotspot={hotspot} activeTab={tab} onTabChange={setTab} scoreData={scoreFixture} scoreError={false} technical={true} viewLabel="Component preview"/>}
    {surface==='policy' && <main id="main-content" className="fixture-content staff-workspace"><h1 className="mb-5 text-3xl">Policy review · test records</h1><RecommendationDraftForm hotspotId={hotspotId} setHotspotId={setHotspotId} bundleId={bundleId} setBundleId={setBundleId} title={title} setTitle={setTitle} pending={false} submit={()=>setMessage('Fixture only: proposal was not created.')} cancel={()=>setMessage('Fixture form cancelled; no API call.')}/><div className="policy-review-grid mt-5 grid gap-5 xl:grid-cols-[minmax(15rem,1fr)_minmax(0,2fr)_minmax(17rem,.9fr)]"><Queue items={[recommendation,{...recommendation,recommendation_id:'fixture-two',title:'Review street access · missing site evidence'}]} selectedId={recommendation.recommendation_id} select={()=>setMessage('Fixture queue selection only.')}/><Brief item={recommendation}/><DecisionRail item={recommendation} note={note} setNote={setNote} reason={reason} setReason={setReason} pending={false} receipt={null} confirm={()=>setMessage('Fixture only: no decision was recorded.')} createProject={()=>setMessage('Fixture only: no project was created.')} projectPending={false}/></div></main>}
    {surface==='impact' && <main id="main-content" className="fixture-content staff-workspace"><h1 className="mb-5 text-3xl">Projects and measured impact · test records</h1><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><ProjectImpactCard project={project} metrics={metrics}/><ProjectImpactCard project={{...project,project_id:'fixture-empty',title:'Measurement pending · fixture'}} metrics={[]}/><ProjectImpactCard project={{...project,project_id:'fixture-error',title:'Unavailable measurement · fixture'}} error/></div></main>}
    {surface==='states' && <main id="main-content" className="fixture-content grid grid-cols-1 gap-5"><h1 className="text-3xl">Loading, empty and error · test states</h1><div role="status" aria-label="Loading public infrastructure updates" className="grid gap-4 md:grid-cols-2"><Skeleton className="h-64"/><Skeleton className="h-64"/></div><PublicHotspotState title={t('emptyTitle')} body={t('emptyBody')}/><PublicHotspotState title={t('unavailable')} body={t('hotspotUnavailableBody')} retry={()=>setMessage('Fixture retry only.')} retryLabel={t('retry')}/><Loading/><State icon={null} title="No recommendations in this view" message="Illustrative empty state."/><State icon={null} title="Recommendations unavailable" message="Illustrative error state." retry={()=>setMessage('Fixture retry only.')}/></main>}
  </>;
}
createRoot(document.getElementById('root')!).render(<PublicLocaleProvider><Preview/></PublicLocaleProvider>);
